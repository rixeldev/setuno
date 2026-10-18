#!/usr/bin/env node
/**
 * Seeds the E2E runner account on STAGING (roadmap #75 / P0.8).
 *
 * The Maestro journey (`e2e/journey.yaml`) signs in as a real account, so the
 * harness needs one that already exists and starts inside a band with no
 * leftover data from previous runs mattering (every run creates its own
 * timestamped song/setlist/event). This script creates that account and the
 * minimum world around it, entirely through the public client APIs — the same
 * rules a signed-in user gets, never an Admin key:
 *
 *   1. `accounts:signUp` with the staging web API key (falls back to
 *      `signInWithPassword` when the address already exists, so re-running is
 *      safe and idempotent).
 *   2. One `documents:batchWrite` writing all five documents the app's own
 *      sign-up/create-organization writes would produce — username claim,
 *      profile (with `onboarded: true` so the tour never blocks a run),
 *      organization, the owner's membership and the profile's band mirror.
 *      The batch is atomic because `firestore.rules` evaluates the profile and
 *      membership creates with `getAfter()`: the username claim and the owner
 *      document must land in the same batch, exactly like `createOrganization`.
 *
 * Credentials live in the gitignored `.env.e2e` (E2E_EMAIL / E2E_PASSWORD) or
 * straight in the environment; staging config comes from `.env.staging`, the
 * same file `APP_ENV=staging` builds read. Never point this at production.
 */
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const loadEnvFile = (root, name) => {
  try {
    return Object.fromEntries(
      readFileSync(join(root, name), "utf8")
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.trim().startsWith("#") && line.includes("="))
        .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
    )
  } catch {
    return {}
  }
}

const root = process.cwd()
const staging = loadEnvFile(root, ".env.staging")
const e2e = loadEnvFile(root, ".env.e2e")

const env = (name) => process.env[name] ?? e2e[name] ?? staging[name] ?? ""

const projectId = env("FIREBASE_STAGING_PROJECT_ID")
const apiKey = env("FIREBASE_STAGING_API_KEY")
const email = env("E2E_EMAIL")
const password = env("E2E_PASSWORD")

if (!projectId || !apiKey || !email || !password) {
  console.error(
    "[e2e] missing configuration: needs FIREBASE_STAGING_PROJECT_ID + FIREBASE_STAGING_API_KEY " +
      "(from .env.staging) and E2E_EMAIL + E2E_PASSWORD (from .env.e2e or the environment)",
  )
  process.exit(1)
}
if (!projectId.endsWith("-staging")) {
  console.error(`[e2e] refusing to run against "${projectId}" — this script only seeds staging`)
  process.exit(1)
}

const call = async (path, body, idToken) => {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const json = await response.json()
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status}: ${JSON.stringify(json.error ?? json)}`)
  }
  return json
}

// 1. The auth account: sign up, or sign in when a previous run created it.
let uid
let idToken
try {
  const created = await call("accounts:signUp", { email, password, returnSecureToken: true })
  uid = created.localId
  idToken = created.idToken
  console.log(`[e2e] created the auth account ${email} (${uid})`)
} catch (error) {
  const message = String(error)
  // New API-created projects have no Authentication configuration until the
  // console's "Get started" runs — there is no REST path around it (P0.8).
  if (message.includes("CONFIGURATION_NOT_FOUND") || message.includes("OPERATION_NOT_ALLOWED")) {
    console.error(
      "[e2e] staging Authentication is not provisioned yet: open the staging Firebase console → " +
        "Authentication → Get started → Sign-in method → Email/Password (enabled), then re-run. " +
        "See README §E2E.",
    )
    process.exit(1)
  }
  if (!message.includes("EMAIL_EXISTS")) throw error
  const session = await call("accounts:signInWithPassword", { email, password, returnSecureToken: true })
  uid = session.localId
  idToken = session.idToken
  console.log(`[e2e] the auth account already existed — signed in (${uid})`)
}

// 2. The world around it, mirroring services/usernames.ts, services/users.ts
//    and services/organizations.ts, batched because rules use getAfter().
const ts = { timestampValue: new Date().toISOString() }
const username = (email.split("@")[0] ?? "e2e").toLowerCase().replace(/[^a-z0-9-]/g, "") || "e2e"
const organizationId = "e2e-band"
const doc = (path, fields) => ({
  update: {
    name: `projects/${projectId}/databases/(default)/documents/${path}`,
    fields,
  },
  currentDocument: { exists: false },
})
const s = (value) => ({ stringValue: value })

const writes = [
  doc(`usernames/${username}`, { uid: s(uid) }),
  doc(`users/${uid}`, {
    displayName: s(username),
    email: s(email),
    photoURL: { nullValue: null },
    organizationIds: { arrayValue: {} },
    activeOrganizationId: { nullValue: null },
    preferences: { mapValue: {} },
    onboarded: { booleanValue: true },
    usernameChangedAt: { nullValue: null },
    createdAt: ts,
    updatedAt: ts,
  }),
  doc(`organizations/${organizationId}`, {
    name: s("E2E Band"),
    description: s("Seeded by scripts/e2eSetup.mjs for the Maestro journey"),
    logoURL: { nullValue: null },
    ownerId: s(uid),
    createdAt: ts,
    updatedAt: ts,
  }),
  doc(`organizations/${organizationId}/members/${uid}`, {
    uid: s(uid),
    displayName: s(username),
    email: s(email),
    photoURL: { nullValue: null },
    role: s("admin"),
    joinedAt: ts,
    invitedBy: { nullValue: null },
  }),
  doc(`users/${uid}/organizations/${organizationId}`, {
    name: s("E2E Band"),
    role: s("admin"),
    logoURL: { nullValue: null },
    joinedAt: ts,
  }),
]

const response = await fetch(
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:batchWrite`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ writes }),
  },
)
const result = await response.json()
if (!response.ok) {
  console.error(`[e2e] batchWrite failed: ${response.status} ${JSON.stringify(result)}`)
  process.exit(1)
}
const failed = (result.writeResults ?? []).find((r) => r.status && r.status.code !== 0 && r.status.code !== undefined)
if (failed) {
  // A re-run against an already-seeded world trips the exists:false preconditions;
  // that is fine — the goal (docs present) is already reached.
  console.log(`[e2e] some documents already existed (${JSON.stringify(failed.status)}) — world is seeded`)
} else {
  console.log(`[e2e] seeded username "${username}", band "${organizationId}" and the profile mirror`)
}
console.log(`[e2e] ready: run the journey with the ${email} account`)

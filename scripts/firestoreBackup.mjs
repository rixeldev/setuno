#!/usr/bin/env node
/**
 * Backup driver for the managed Firestore backups (roadmap #81 / P0.6).
 *
 * Managed backups are schedule-driven: the v1 API exposes no on-demand
 * backup creation, so a backup exists only after the daily schedule has
 * fired once. This script owns the operations the README's Backups
 * runbook repeats:
 *
 *   status  list the backup schedule(s) and the backups that exist
 *   wait    poll until the first READY backup shows up (right after the
 *           schedule is enabled, the first one lands within ~24h)
 *   drill   restore the latest READY backup into a scratch database, wait
 *           until it is ACTIVE, then delete the scratch database again -
 *           the "prove a restore actually works" rehearsal. `--keep` leaves
 *           the restored database around for inspection.
 *   cleanup remove the scratch database if a --keep drill left it behind
 *
 * Auth reuses the owner's own `firebase-tools` login (any real CLI call
 * refreshes and persists its configstore token, so we shell out to the CLI
 * when the stored token is stale and never handle credentials ourselves).
 * The Firestore REST API does the rest; no SDK dependency.
 *
 *   node scripts/firestoreBackup.mjs status
 *   node scripts/firestoreBackup.mjs wait
 *   node scripts/firestoreBackup.mjs drill [--keep]
 */
import { execFileSync } from "node:child_process"
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const PROJECT = JSON.parse(readFileSync(join(process.cwd(), ".firebaserc"), "utf8")).projects.default
const DB = "(default)"
const DRILL_DB_ID = "setuno-restore-drill"
const API = "https://firestore.googleapis.com/v1"
const RULES_API = "https://firebaserules.googleapis.com/v1"
const POLL_MS = 5000
const WAIT_POLL_MS = 60_000
const TIMEOUT_MS = 10 * 60 * 1000
// A restore of this dataset took ~11 min end to end; give the operation room.
const RESTORE_TIMEOUT_MS = 25 * 60 * 1000

const fail = (message) => {
  console.error(`[backup] ${message}`)
  process.exit(1)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** The firebase-tools configstore, refreshed through the CLI when stale. */
const readToken = () => {
  const path = join(homedir(), ".config", "configstore", "firebase-tools.json")
  if (!existsSync(path)) fail("No firebase-tools login found - run: npx firebase-tools login")
  const tokens = JSON.parse(readFileSync(path, "utf8")).tokens
  if (!tokens?.access_token) fail("firebase-tools has no access token - run: npx firebase-tools login")
  return tokens
}

/** Locate the firebase-tools CLI without relying on npx's shell resolution. */
const findCli = () => {
  const local = join(process.cwd(), "node_modules", "firebase-tools", "lib", "bin", "firebase.js")
  if (existsSync(local)) return local
  const roots = [
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "npm-cache", "_npx") : null,
    join(homedir(), "AppData", "Local", "npm-cache", "_npx"),
  ].filter(Boolean)
  const candidates = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root)) {
      const cli = join(root, entry, "node_modules", "firebase-tools", "lib", "bin", "firebase.js")
      if (existsSync(cli)) candidates.push(cli)
    }
  }
  if (candidates.length === 0) return null
  // Several npx caches can coexist; the most recently touched one is the
  // version `npx -y firebase-tools` resolves to.
  return candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
}

const cliPath = findCli()

const runCli = (args, { quiet = false } = {}) => {
  const allArgs = [...args, "--project", PROJECT]
  try {
    if (cliPath) {
      // No shell: backup names contain "(default)" and would need escaping.
      return execFileSync(process.execPath, [cliPath, ...allArgs], {
        encoding: "utf8",
        stdio: ["ignore", quiet ? "ignore" : "pipe", quiet ? "ignore" : "pipe"],
        timeout: 120_000,
      })
    }
    return execFileSync(
      `npx -y firebase-tools ${allArgs.map((arg) => `"${arg}"`).join(" ")}`,
      {
        shell: true,
        encoding: "utf8",
        stdio: ["ignore", quiet ? "ignore" : "pipe", quiet ? "ignore" : "pipe"],
        timeout: 120_000,
      },
    )
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.stdout?.toString().trim() || error.message
    throw new Error(`firebase ${args.join(" ")} failed: ${detail}`)
  }
}

const accessToken = async () => {
  let tokens = readToken()
  const stale = (tokens.expires_at ?? 0) < Date.now() + 60_000
  if (stale) {
    // Only a real API call refreshes and persists the stored token - a
    // --version short-circuit never reaches the auth layer.
    runCli(["firestore:databases:list"], { quiet: true })
    tokens = readToken()
  }
  return tokens.access_token
}

/** REST call; throws on any non-OK response (401 exits: not recoverable). */
const call = async (method, path, body, base = API) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (response.status === 401) fail("Token rejected - run: npx firebase-tools login")
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${await response.text()}`)
  return response.json()
}

const cli = (...args) => runCli(args)

const dbPath = (databaseId) => `/projects/${PROJECT}/databases/${encodeURIComponent(databaseId)}`

/** Backups live under the database's location, not under the database. */
let cachedLocation = null
const backupCollection = async () => {
  if (!cachedLocation) cachedLocation = (await call("GET", dbPath(DB))).locationId
  return `/projects/${PROJECT}/locations/${cachedLocation}/backups`
}

const listBackups = async () => (await call("GET", await backupCollection())).backups ?? []

const latestReadyBackup = async () => {
  const backups = (await listBackups())
    .filter((b) => b.state === "READY")
    .sort((a, b) => (a.createTime < b.createTime ? 1 : -1))
  return backups[0] ?? null
}

const waitForDatabase = async (databaseId) => {
  const deadline = Date.now() + RESTORE_TIMEOUT_MS
  for (;;) {
    try {
      const database = await call("GET", dbPath(databaseId))
      // The database resource carries no `state` on this API surface: the
      // authoritative completion signal is the restore operation itself.
      const operationPath = database.sourceInfo?.operation
      if (operationPath) {
        const operation = await call("GET", `/${operationPath}`)
        if (operation.done) {
          if (operation.error) fail(`Restore failed: ${JSON.stringify(operation.error)}`)
          return call("GET", dbPath(databaseId))
        }
        process.stdout.write("[backup] restore operation running...\r")
      } else if (database.earliestVersionTime) {
        // Settled before we looked: data (and versions) already exist.
        return database
      } else {
        process.stdout.write("[backup] restored database: creating...\r")
      }
    } catch (error) {
      if (!String(error).includes("404")) throw error
      process.stdout.write("[backup] restored database: creating...\r")
    }
    if (Date.now() > deadline) fail(`Database ${databaseId} not restored after ${RESTORE_TIMEOUT_MS / 60000} min`)
    await sleep(POLL_MS)
  }
}

const hasDrillDatabase = () =>
  cli("firestore:databases:list")
    .split("\n")
    .some((line) => line.includes(DRILL_DB_ID))

const waitForDrillDatabaseGone = async () => {
  const deadline = Date.now() + TIMEOUT_MS
  while (hasDrillDatabase()) {
    if (Date.now() > deadline) fail("Scratch database is still being deleted after 10 min")
    process.stdout.write("[backup] waiting for the previous scratch database to finish deleting...\r")
    await sleep(POLL_MS)
  }
}

const removeDrillDatabase = async () => {
  if (!hasDrillDatabase()) return false
  console.log(`[backup] removing scratch database ${DRILL_DB_ID}...`)
  // A scratch database still settling a previous restore refuses deletion
  // ("in the middle of restore"); wait it out instead of failing the drill.
  const deadline = Date.now() + RESTORE_TIMEOUT_MS
  for (;;) {
    try {
      cli("firestore:databases:delete", DRILL_DB_ID, "--force")
      return true
    } catch (error) {
      if (!String(error).includes("middle of restore")) throw error
      if (Date.now() > deadline) throw error
      process.stdout.write("[backup] previous restore still settling; retrying deletion...\r")
      await sleep(POLL_MS)
    }
  }
}

const status = () => {
  console.log(cli("firestore:backups:schedules:list").trim())
  console.log(cli("firestore:backups:list").trim())
}

const wait = async () => {
  console.log("[backup] polling for the first READY backup (the schedule's first run)...")
  const started = Date.now()
  for (;;) {
    try {
      const ready = await latestReadyBackup()
      if (ready) {
        const minutes = Math.round((Date.now() - started) / 60000)
        console.log(`[backup] READY backup available after ~${minutes} min: ${ready.name}`)
        return
      }
    } catch {
      // Transient REST failure: keep polling.
    }
    const minutes = Math.round((Date.now() - started) / 60000)
    process.stdout.write(`[backup] no READY backup yet (${minutes} min elapsed)...\r`)
    await sleep(WAIT_POLL_MS)
  }
}

/** Deleting a database keeps its id in a tombstone for ~2 minutes; retry. */
const restoreDrillDatabase = async (backupName) => {
  const deadline = Date.now() + TIMEOUT_MS
  for (;;) {
    try {
      cli("firestore:databases:restore", "-d", DRILL_DB_ID, "-b", backupName)
      return
    } catch (error) {
      if (!String(error).includes("not available")) throw error
      if (Date.now() > deadline) throw error
      process.stdout.write("[backup] id still tombstoned from a previous drill; retrying...\r")
      await sleep(65_000)
    }
  }
}

const drill = async (keep) => {
  // A leftover drill database would make the restore fail on a reused id,
  // and deletion is asynchronous - wait until it actually disappears.
  await removeDrillDatabase()
  await waitForDrillDatabaseGone()

  const backup = await latestReadyBackup()
  if (!backup) {
    fail(
      "No READY backup yet - the schedule creates the first one within ~24h of being enabled. " +
        "Run: node scripts/firestoreBackup.mjs wait",
    )
  }
  console.log(`[backup] restoring ${backup.name} into ${DRILL_DB_ID}...`)
  await restoreDrillDatabase(backup.name)

  const database = await waitForDatabase(DRILL_DB_ID)
  // Rules live outside the backup (Google's docs: a backup carries neither
  // security rules nor TTL) and are bound to a database id through a
  // release, so ask the Firebase Rules API what this copy's id has. A
  // data-plane probe cannot measure rules: the CLI's Google OAuth token is
  // not a Firebase client, and listCollectionIds only reports which root
  // collections exist (it listed the live production roots identically -
  // a control that turned an earlier "OPEN" alarm into a non-finding).
  let rulesState = null
  for (let attempt = 0; attempt < 3 && rulesState === null; attempt += 1) {
    try {
      const releases = await call("GET", `/projects/${PROJECT}/releases?pageSize=100`, undefined, RULES_API)
      const drillRules = (releases.releases ?? []).filter((r) => r.name.includes(DRILL_DB_ID))
      rulesState =
        drillRules.length === 0
          ? "closed (no rules release bound to this database id - a fresh id denies all web/mobile client reads, per Google's docs)"
          : `rules RELEASED for this copy: ${drillRules.map((r) => r.name).join(", ")} - review before anyone touches it`
    } catch (error) {
      if (attempt === 2) rulesState = `unknown (${String(error).slice(0, 120)})`
      else await sleep(10_000)
    }
  }
  console.log(`\n[backup] RESTORE OK: ${DRILL_DB_ID}, restored from snapshot ${database.sourceInfo?.backup?.snapshotTime ?? "?"}`)
  console.log(`[backup] rules state of the restored copy: ${rulesState}`)

  if (keep) {
    console.log(
      `[backup] --keep: leaving ${DRILL_DB_ID} in place (delete with: node scripts/firestoreBackup.mjs cleanup)`,
    )
    return
  }
  await removeDrillDatabase()
  console.log("[backup] drill complete: restore proven, scratch database deleted")
}

const command = process.argv[2]
const keep = process.argv.includes("--keep")

try {
  if (command === "status") status()
  else if (command === "wait") await wait()
  else if (command === "drill") await drill(keep)
  else if (command === "cleanup") {
    if (!(await removeDrillDatabase())) console.log("[backup] no scratch database to remove")
  } else {
    console.log("Usage: node scripts/firestoreBackup.mjs <status|wait|drill|cleanup> [--keep]")
    process.exit(command ? 1 : 0)
  }
} catch (error) {
  fail(String(error.message ?? error))
}

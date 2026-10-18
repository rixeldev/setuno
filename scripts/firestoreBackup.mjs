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
const POLL_MS = 5000
const WAIT_POLL_MS = 60_000
const TIMEOUT_MS = 10 * 60 * 1000

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
    throw new Error(`firebase ${args.join(" ")} failed: ${error.stderr?.toString().trim() || error.message}`)
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
const call = async (method, path, body) => {
  const response = await fetch(`${API}${path}`, {
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
  const deadline = Date.now() + TIMEOUT_MS
  for (;;) {
    try {
      const database = await call("GET", dbPath(databaseId))
      if (database.state === "ACTIVE") return database
      if (database.state === "FAILED") fail(`Database ${databaseId} entered state FAILED`)
      process.stdout.write(`[backup] restored database state: ${database.state}...\r`)
    } catch (error) {
      if (!String(error).includes("404")) throw error
      process.stdout.write("[backup] restored database: creating...\r")
    }
    if (Date.now() > deadline) fail(`Database ${databaseId} not ACTIVE after ${TIMEOUT_MS / 60000} min`)
    await sleep(POLL_MS)
  }
}

const hasDrillDatabase = () =>
  cli("firestore:databases:list")
    .split("\n")
    .some((line) => line.includes(DRILL_DB_ID))

const removeDrillDatabase = () => {
  if (!hasDrillDatabase()) return false
  console.log(`[backup] removing scratch database ${DRILL_DB_ID}...`)
  cli("firestore:databases:delete", DRILL_DB_ID, "--force")
  return true
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

const drill = async (keep) => {
  // A leftover drill database would make the restore fail on a reused id.
  removeDrillDatabase()

  const backup = await latestReadyBackup()
  if (!backup) {
    fail(
      "No READY backup yet - the schedule creates the first one within ~24h of being enabled. " +
        "Run: node scripts/firestoreBackup.mjs wait",
    )
  }
  console.log(`[backup] restoring ${backup.name} into ${DRILL_DB_ID}...`)
  cli("firestore:databases:restore", "-d", DRILL_DB_ID, "-b", backup.name)

  const database = await waitForDatabase(DRILL_DB_ID)
  let reads = "unknown"
  try {
    await call("GET", `${dbPath(DRILL_DB_ID)}/documents?pageSize=1`)
    reads = "open (unexpected on a fresh restore)"
  } catch (error) {
    // The restored database ships with closed rules, so a data-plane read
    // is denied - which is exactly the documented default.
    reads = String(error).includes("403") ? "closed (rules block reads - documented default)" : "unknown"
  }
  console.log(`\n[backup] RESTORE OK: ${DRILL_DB_ID} state=${database.state}, created ${database.createTime}`)
  console.log(`[backup] data-plane read on the restored copy: ${reads}`)

  if (keep) {
    console.log(
      `[backup] --keep: leaving ${DRILL_DB_ID} in place (delete with: node scripts/firestoreBackup.mjs cleanup)`,
    )
    return
  }
  removeDrillDatabase()
  console.log("[backup] drill complete: restore proven, scratch database deleted")
}

const command = process.argv[2]
const keep = process.argv.includes("--keep")

try {
  if (command === "status") status()
  else if (command === "wait") await wait()
  else if (command === "drill") await drill(keep)
  else if (command === "cleanup") {
    if (!removeDrillDatabase()) console.log("[backup] no scratch database to remove")
  } else {
    console.log("Usage: node scripts/firestoreBackup.mjs <status|wait|drill|cleanup> [--keep]")
    process.exit(command ? 1 : 0)
  }
} catch (error) {
  fail(String(error.message ?? error))
}

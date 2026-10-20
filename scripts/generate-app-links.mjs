// Writes the App Links verification files the web deploy serves (roadmap #76):
//
//   <out>/.well-known/assetlinks.json              (Android App Links)
//   <out>/.well-known/apple-app-site-association  (iOS Universal Links)
//
// The **hosts** and the **claimed paths** come from `app-links.json`, the one
// source of truth `app.config.js` also reads for the intent filter — a host
// claimed by the app and a host served by the web deploy can never drift.
//
// The **SHA-256 fingerprints** are the signing keys' certificates:
//   - `app-links.json` lists the *release* one (the EAS keystore), which the
//     owner adds once it is known;
//   - the *local debug* keystore is picked up automatically when it exists, so
//     a development build on this machine verifies without any setup.
//
// Usage: node scripts/generate-app-links.mjs [outDir]   (default: dist/.well-known)
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const config = JSON.parse(readFileSync(join(root, "app-links.json"), "utf8"))
const outDir = process.argv[2] ? join(root, process.argv[2]) : join(root, "dist", ".well-known")

/**
 * The SHA-256 of the local Android debug keystore, when there is one.
 *
 * `keytool` is the only honest way to read a JKS/PKCS12 certificate, and a
 * missing JDK is not an error: the release fingerprint in `app-links.json`
 * still covers the shipped build.
 */
const debugFingerprint = () => {
  const keystore = join(homedir(), ".android", "debug.keystore")
  if (!existsSync(keystore)) return null
  try {
    const output = execFileSync(
      "keytool",
      [
        "-list",
        "-v",
        "-keystore",
        keystore,
        "-storepass",
        "android",
        "-alias",
        "androiddebugkey",
        "-keypass",
        "android",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    )
    const match = /SHA256:\s*([0-9A-F:]+)/i.exec(output)
    return match?.[1]?.trim().toUpperCase() ?? null
  } catch {
    // No keytool, no JDK, or a keystore we cannot read — not fatal.
    return null
  }
}

const fingerprints = () => {
  const list = (config.sha256Fingerprints ?? []).map((value) => value.toUpperCase())
  const debug = debugFingerprint()
  if (debug && !list.includes(debug)) list.push(debug)
  return list
}

/** Android's `assetlinks.json`: the app may claim every URL on the host. */
const assetLinks = () => [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: config.packageName,
      sha256_cert_fingerprints: fingerprints(),
    },
  },
]

/**
 * Apple's `apple-app-site-association`: the same claim, with the team id.
 *
 * It needs the **Apple Developer team id**, which this repo does not know —
 * the app does not build for iOS yet, so the file is written only when
 * `APPLE_TEAM_ID` is set. A placeholder would be worse than none: iOS rejects
 * the file outright and says nothing about why.
 */
const appleAppSiteAssociation = () => {
  const teamId = process.env.APPLE_TEAM_ID
  if (!teamId) return null
  return {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [`${teamId}.${config.bundleId}`],
          components: [
            {
              "/": `/*`,
              comment: "Every Setuno link opens the app.",
            },
          ],
        },
      ],
    },
  }
}

mkdirSync(outDir, { recursive: true })

const androidPath = join(outDir, "assetlinks.json")
writeFileSync(androidPath, `${JSON.stringify(assetLinks(), null, 2)}\n`, "utf8")
console.log("assetlinks.json →", androidPath)
console.log("  hosts:", config.hosts.join(", "))
console.log("  paths:", config.paths.join(", "))
console.log("  fingerprints:", fingerprints().length || "none (add the release SHA-256 to app-links.json)")

const ios = appleAppSiteAssociation()
if (ios) {
  const iosPath = join(outDir, "apple-app-site-association")
  writeFileSync(iosPath, `${JSON.stringify(ios, null, 2)}\n`, "utf8")
  console.log("apple-app-site-association →", iosPath)
} else {
  console.log("apple-app-site-association → skipped (set APPLE_TEAM_ID to write it)")
}

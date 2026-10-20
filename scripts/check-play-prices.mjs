// Reads the live Play prices of the Pro plan, straight from the Play
// Developer API — the same source of truth the store charges from.
//
// The credentials come from `docs/service-account/*.json` (a folder the repo
// ignores), so nothing secret ever lands in the code.
//
// Usage: node scripts/check-play-prices.mjs

import { readFileSync, readdirSync } from "node:fs"
import { createSign } from "node:crypto"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const folder = join(root, "docs", "service-account")

const files = readdirSync(folder).filter((name) => name.endsWith(".json"))

if (files.length === 0) {
  console.error(
    "No service account JSON in docs/service-account — cannot ask Play.",
  )
  process.exit(1)
}

const account = JSON.parse(readFileSync(join(folder, files[0]), "utf8"))

const base64url = (value) => Buffer.from(value, "utf8").toString("base64url")

const issued = Math.floor(Date.now() / 1000)
const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))

const claims = base64url(
  JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: issued,
    exp: issued + 3600,
  }),
)

const signature = createSign("RSA-SHA256")
  .update(`${header}.${claims}`)
  .sign(account.private_key, "base64url")

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${header}.${claims}.${signature}`,
  }),
})

const token = await tokenResponse.json()

if (!tokenResponse.ok || !token.access_token) {
  console.error(
    "The token endpoint refused the credential:",
    token.error_description ?? token.error ?? token,
  )
  process.exit(1)
}

const response = await fetch(
  "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.rixeldev.setuno/subscriptions",
  {
    headers: {
      authorization: `Bearer ${token.access_token}`,
    },
  },
)

const body = await response.json()

if (!response.ok) {
  console.error("Google Play API request failed:", body)
  process.exit(1)
}

const subscriptions = Array.isArray(body) ? body : (body.subscriptions ?? [])

function formatPrice(price) {
  if (!price || !price.currencyCode) return "—"

  const units = BigInt(price.units ?? 0)
  const nanos = BigInt(price.nanos ?? 0)

  // Google Play Money supports up to 9 decimal places.
  const negative = units < 0n
  const absoluteUnits = negative ? -units : units
  const wholeNanos = absoluteUnits * 1_000_000_000n + nanos

  const whole = wholeNanos / 1_000_000_000n
  const fraction = (wholeNanos % 1_000_000_000n).toString().padStart(9, "0")

  const decimal = Number(`${whole}.${fraction}`)

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currencyCode,
  }).format(negative ? -decimal : decimal)
}

for (const subscription of subscriptions) {
  console.log(`\nSubscription: ${subscription.productId}`)

  for (const plan of subscription.basePlans ?? []) {
    const configs = plan.regionalConfigs ?? []

    console.log(`  ${plan.basePlanId} (${plan.state})`)

    for (const regionCode of ["US", "ES", "BR"]) {
      const config = configs.find((item) => item.regionCode === regionCode)

      console.log(`    ${regionCode} ${formatPrice(config?.price)}`)
    }

    console.log(`    ${configs.length} regions in total`)
  }
}

console.log("\nPrices above are read from the Google Play Developer API.")

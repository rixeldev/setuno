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
if (!readdirSync(folder).length) {
  console.error("No service account JSON in docs/service-account — cannot ask Play.")
  process.exit(1)
}
const file = readdirSync(folder).find((name) => name.endsWith(".json"))
const account = JSON.parse(readFileSync(join(folder, file), "utf8"))

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
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${header}.${claims}.${signature}`,
  }),
})
const token = await tokenResponse.json()
if (!token.access_token) {
  console.error("The token endpoint refused the credential:", token.error ?? token.error_description)
  process.exit(1)
}

const response = await fetch(
  "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.rixeldev.setuno/subscriptions",
  { headers: { authorization: `Bearer ${token.access_token}` } },
)
const body = await response.json()
const subscriptions = Array.isArray(body) ? body : (body.subscriptions ?? [])

const amount = (config) => {
  const price = config.price ?? {}
  return price.nanos !== undefined ? price.units + price.nanos / 1e9 : price.units
}

for (const subscription of subscriptions) {
  console.log(`\nsuscripción: ${subscription.productId}`)
  for (const plan of subscription.basePlans ?? []) {
    const configs = plan.regionalConfigs ?? []
    const us = configs.find((config) => config.regionCode === "US")
    const es = configs.find((config) => config.regionCode === "ES")
    const br = configs.find((config) => config.regionCode === "BR")
    console.log(`  ${plan.basePlanId} (${plan.state})`)
    console.log(`    US ${us ? `${us.price?.currencyCode} ${amount(us)}` : "—"}`)
    console.log(`    ES ${es ? `${es.price?.currencyCode} ${amount(es)}` : "—"}`)
    console.log(`    BR ${br ? `${br.price?.currencyCode} ${amount(br)}` : "—"}`)
    console.log(`    ${configs.length} regiones en total`)
  }
}
console.log(
  "\nSi la consola de Play muestra otra cosa, es un cambio de precio pendiente: lo que se cobra es esto.",
)

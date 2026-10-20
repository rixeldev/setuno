import { createSign } from "crypto"

/**
 * The Google Play Developer API (roadmap #61).
 *
 * The purchase is confirmed **on the server**: the phone tells the callable
 * which token the store gave it, and the callable asks Google whether that
 * token is a real, paid, unexpired purchase. A phone that lies is talking to
 * Google, not to us.
 *
 * The service account is read from the environment (`PLAY_SERVICE_ACCOUNT_JSON`).
 * Without it the callable refuses the purchase — a Pro plan is never granted
 * on trust, and a missing credential must not fall back to "probably fine".
 */

export interface PlayPurchase {
  /** True when the purchase is paid and not expired. */
  active: boolean
  /** When the period ends (ISO date). `null`: never (a consumable tip). */
  expiresAt: string | null
}

export interface ServiceAccount {
  client_email: string
  private_key: string
}

/**
 * The credential, from the environment.
 *
 * Two shapes are accepted, because both are awkward in different ways:
 *
 *   • `PLAY_SERVICE_ACCOUNT_JSON` — the whole key file in one line (the file
 *     Google downloads is a single line once minified, and its `private_key`
 *     already carries the newlines escaped as `\n`).
 *   • `PLAY_SERVICE_ACCOUNT_CLIENT_EMAIL` + `PLAY_SERVICE_ACCOUNT_PRIVATE_KEY` —
 *     the same key in two variables, which is what a secret manager or a
 *     `.env` file handles most comfortably.
 *
 * Returns `null` when neither is there: the caller then **refuses** the
 * purchase, because a missing credential must never fall back to "probably
 * fine".
 */
export const serviceAccountFromEnv = (): ServiceAccount | null => {
  const json = process.env.PLAY_SERVICE_ACCOUNT_JSON
  if (json && json.trim().length > 0) {
    const parsed = serviceAccountFromJson(json)
    if (parsed) return parsed
  }
  const email = process.env.PLAY_SERVICE_ACCOUNT_CLIENT_EMAIL
  const key = process.env.PLAY_SERVICE_ACCOUNT_PRIVATE_KEY
  if (email && key && key.length > 0) {
    // A PEM pasted with literal "\n" (an unquoted env value) becomes a real
    // key; one written with real newlines is left alone.
    return { client_email: email, private_key: key.replace(/\\n/g, "\n") }
  }
  return null
}

/** The same credential read from a JSON blob (the Secret Manager's value). */
export const serviceAccountFromJson = (json: string): ServiceAccount | null => {
  try {
    const parsed = JSON.parse(json) as ServiceAccount
    if (parsed?.client_email && parsed?.private_key) {
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key.replace(/\\n/g, "\n"),
      }
    }
    return null
  } catch {
    return null
  }
}

const PLAY_API = "https://androidpublisher.googleapis.com/androidpublisher/v3"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const SCOPE = "https://www.googleapis.com/auth/androidpublisher"

const base64url = (value: string): string => Buffer.from(value, "utf8").toString("base64url")

/** The service account's own JWT — the key the token endpoint wants. */
const accountAssertion = (account: ServiceAccount): string => {
  const issued = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: issued,
      exp: issued + 3600,
    }),
  )
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(account.private_key, "base64url")
  return `${header}.${claims}.${signature}`
}

/** A short-lived access token for the Play API. */
const accessToken = async (account: ServiceAccount): Promise<string> => {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: accountAssertion(account),
    }),
  })
  if (!response.ok) throw new Error(`play-token:${response.status}`)
  const body = (await response.json()) as { access_token?: string }
  if (!body.access_token) throw new Error("play-token:missing")
  return body.access_token
}

interface SubscriptionPurchase {
  subscriptionState?: number
  lineItems?: { expiryTime?: string }[]
}

interface ProductPurchase {
  purchaseState?: number
  consumptionState?: number
}

/**
 * Confirms a purchase with the store.
 *
 * A subscription is active while Google says so (state 1) and it expires on
 * the line item's own date; a one-off product (the tip, roadmap #64) is
 * active while it has been bought and not refunded (state 0, not consumed).
 */
export const verifyPlayPurchase = async (input: {
  serviceAccount: ServiceAccount
  packageName: string
  productId: string
  purchaseToken: string
  /** A subscription is confirmed through the subscriptions API; a one-off
   * product through the products API. */
  kind: "subscription" | "tip"
}): Promise<PlayPurchase> => {
  const account = input.serviceAccount
  if (!account.client_email || !account.private_key) throw new Error("play-account:incomplete")

  const token = await accessToken(account)
  const isSubscription = input.kind === "subscription"
  const url = isSubscription
    ? `${PLAY_API}/applications/${encodeURIComponent(input.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(input.purchaseToken)}`
    : `${PLAY_API}/applications/${encodeURIComponent(input.packageName)}/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}`

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (response.status === 404) {
    // The store does not know this token: it was never paid for.
    return { active: false, expiresAt: null }
  }
  if (!response.ok) throw new Error(`play-purchase:${response.status}`)

  if (isSubscription) {
    const body = (await response.json()) as SubscriptionPurchase
    const expiry = body.lineItems?.[0]?.expiryTime
    return {
      active: body.subscriptionState === 1,
      expiresAt: expiry ? expiry.slice(0, 10) : null,
    }
  }
  const body = (await response.json()) as ProductPurchase
  return {
    active: body.purchaseState === 0 && body.consumptionState === 0,
    expiresAt: null,
  }
}

/**
 * Consumes a one-off purchase (the tip, roadmap #64) so the member can tip
 * again. A consumable that is never consumed can only ever be bought once.
 */
export const consumePlayPurchase = async (input: {
  serviceAccount: ServiceAccount
  packageName: string
  productId: string
  purchaseToken: string
}): Promise<void> => {
  const account = input.serviceAccount
  if (!account.client_email || !account.private_key) throw new Error("play-account:incomplete")

  const token = await accessToken(account)
  const url = `${PLAY_API}/applications/${encodeURIComponent(input.packageName)}/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}:consume`
  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-length": "0" },
  })
  if (!response.ok && response.status !== 404) throw new Error(`play-consume:${response.status}`)
}

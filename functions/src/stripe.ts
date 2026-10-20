import { createHmac, timingSafeEqual } from "crypto"

/**
 * Stripe on the web (roadmap #61's web half).
 *
 * The mobile build buys the plan from **Google Play** (#61's native half);
 * the web build buys the same plan from **Stripe Checkout**, because Play
 * Billing has no web implementation. Both paths end in the **same
 * entitlement document** (`users/{uid}/entitlements/pro`), so the plan is a
 * property of the account and not of the device: buy it on Android and the
 * web is Pro too.
 *
 * Pure — **no firebase imports** — so the signature check (the part that
 * decides whether a webhook is really Stripe) unit-tests in node.
 */

/** The two recurring prices, as the owner set them up in Stripe. */
export interface StripeConfig {
  /** The secret API key (`sk_test_…` / `sk_live_…`). */
  secretKey: string
  /** The signing secret of the webhook endpoint (`whsec_…`). */
  webhookSecret: string
  /** The price id of the monthly plan. */
  priceMonthly: string
  /** The price id of the yearly plan. */
  priceAnnual: string
  /** Where Stripe sends the member back to (the web build's address). */
  webOrigin?: string
}

/** Reads the configuration out of the environment (one JSON blob). */
export const stripeConfigFromEnv = (raw: string | undefined): StripeConfig | null => {
  if (!raw || raw.trim().length === 0) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StripeConfig>
    if (
      typeof parsed.secretKey !== "string" ||
      typeof parsed.webhookSecret !== "string" ||
      typeof parsed.priceMonthly !== "string" ||
      typeof parsed.priceAnnual !== "string"
    ) {
      return null
    }
    return {
      secretKey: parsed.secretKey,
      webhookSecret: parsed.webhookSecret,
      priceMonthly: parsed.priceMonthly,
      priceAnnual: parsed.priceAnnual,
      ...(typeof parsed.webOrigin === "string" ? { webOrigin: parsed.webOrigin } : {}),
    }
  } catch {
    return null
  }
}

/** The price id behind one of the two plans. */
export const stripePriceFor = (config: StripeConfig, plan: "monthly" | "annual"): string =>
  plan === "annual" ? config.priceAnnual : config.priceMonthly

/**
 * A call to Stripe's REST API.
 *
 * No SDK: the API is a plain form-encoded POST, and the functions workspace
 * stays free of another dependency (the `jszip` precedent — a dependency is
 * only worth it when it buys something).
 */
export const stripeApi = async (
  config: StripeConfig,
  path: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<Record<string, unknown>> => {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    body.append(key, String(value))
  }
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  })
  const text = await response.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(text) as Record<string, unknown>
  } catch {
    parsed = {}
  }
  if (!response.ok) {
    const error = parsed.error as { message?: string; type?: string } | undefined
    throw new Error(`stripe:${error?.type ?? response.status}:${error?.message ?? "failed"}`)
  }
  return parsed
}

/** The two plans, with the prices the store answers. */
export interface StripeOffer {
  plan: "monthly" | "annual"
  priceId: string
  /** The amount, in the currency's smallest unit. */
  amount: number
  currency: string
  /** The formatted price, as Stripe writes it ("€40.29"). */
  display: string
}

/**
 * What the two plans cost, read from Stripe.
 *
 * The web build shows the same prices the mobile one does, and the two never
 * drift because both come from the store itself. The amount is returned both
 * as the store's smallest unit and as a formatted string, so the app can show
 * the price with its own currency formatting.
 */
export const stripeOffers = async (config: StripeConfig): Promise<StripeOffer[]> => {
  const offers: StripeOffer[] = []
  for (const plan of ["monthly", "annual"] as const) {
    const priceId = stripePriceFor(config, plan)
    const price = (await stripeApi(config, `prices/${priceId}`, {})) as {
      unit_amount?: number
      currency?: string
      unit_amount_decimal?: string
    }
    const currency = (price.currency ?? "usd").toUpperCase()
    const amount = price.unit_amount ?? 0
    offers.push({
      plan,
      priceId,
      amount,
      currency,
      display: formatPrice(amount, currency, price.unit_amount_decimal),
    })
  }
  return offers
}

/**
 * A price as money: "$3.99".
 *
 * The store's decimal form wins when it has one (a currency with no decimals
 * would come out as "300" otherwise), and the currency is always shown — a
 * bare number in a price the member is about to pay for is a bug waiting to
 * happen.
 */
export const formatPrice = (
  amount: number,
  currency: string,
  decimal?: string,
): string => {
  const value = decimal !== undefined && decimal !== "" ? Number(decimal) : amount / 100
  if (!Number.isFinite(value)) return `${amount} ${currency}`
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value)
  } catch {
    // An unknown currency code must not break the price.
    return `${value.toFixed(2)} ${currency}`
  }
}

/** A Checkout session the member can pay in. */
export interface CheckoutSession {
  /** The URL to open — Stripe's own hosted page. */
  url: string
}

/**
 * Creates the Checkout session for a plan.
 *
 * The member's uid travels in `client_reference_id` and in the metadata, so
 * the webhook can tell whose purchase it is **without trusting the browser**:
 * the client never says who it is, the session does.
 */
export const createCheckoutSession = async (input: {
  config: StripeConfig
  uid: string
  email: string
  plan: "monthly" | "annual"
  /** The band the plan belongs to — the webhook settles that band's plan. */
  organizationId: string
  /** Where Stripe sends the member when the payment is done (or cancelled). */
  successUrl: string
  cancelUrl: string
}): Promise<CheckoutSession> => {
  const session = await stripeApi(input.config, "checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": stripePriceFor(input.config, input.plan),
    "line_items[0][quantity]": 1,
    client_reference_id: input.uid,
    "metadata[uid]": input.uid,
    "metadata[plan]": input.plan,
    "metadata[organizationId]": input.organizationId,
    "subscription_data[metadata][uid]": input.uid,
    "subscription_data[metadata][plan]": input.plan,
    "subscription_data[metadata][organizationId]": input.organizationId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    ...(input.email ? { customer_email: input.email } : {}),
  })
  const url = (session.url as string | undefined) ?? ""
  if (url.length === 0) throw new Error("stripe:session-without-url")
  return { url }
}

/**
 * The billing portal session, where a member cancels or changes their card.
 *
 * The same contract as the native "Manage subscription": a link to the
 * platform's own screen, never a payment link of our own.
 */
export const createBillingPortalSession = async (input: {
  config: StripeConfig
  customerId: string
  returnUrl: string
}): Promise<CheckoutSession> => {
  const session = await stripeApi(input.config, "billing_portal/sessions", {
    customer: input.customerId,
    return_url: input.returnUrl,
  })
  const url = (session.url as string | undefined) ?? ""
  if (url.length === 0) throw new Error("stripe:portal-without-url")
  return { url }
}

/** How old a webhook signature may be before it is refused (replay guard). */
export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300

/**
 * Checks Stripe's signature header.
 *
 * The header is `t=<unix seconds>,v1=<hmac>` and the HMAC is over
 * `"<timestamp>.<the exact body>"` — the body must be the **bytes** Stripe
 * sent, not a re-serialized object, so the caller passes the raw text.
 *
 * A timestamp older than the tolerance is refused: a captured webhook could
 * otherwise be replayed months later.
 */
export const verifyStripeSignature = (input: {
  payload: string
  header: string | null
  secret: string
  toleranceSeconds?: number
  nowSeconds?: number
}): boolean => {
  if (!input.header) return false
  const parts = new Map<string, string[]>()
  for (const chunk of input.header.split(",")) {
    const [key, value] = chunk.split("=")
    if (!key || !value) continue
    const list = parts.get(key) ?? []
    list.push(value)
    parts.set(key, list)
  }
  const timestamp = parts.get("t")?.[0]
  const signatures = parts.get("v1") ?? []
  if (!timestamp || signatures.length === 0) return false

  const tolerance = input.toleranceSeconds ?? STRIPE_SIGNATURE_TOLERANCE_SECONDS
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const age = now - Number(timestamp)
  if (!Number.isFinite(age) || age > tolerance) return false

  const expected = createHmac("sha256", input.secret)
    .update(`${timestamp}.${input.payload}`)
    .digest("hex")
  const expectedBuffer = Buffer.from(expected, "utf8")
  return signatures.some((signature) => {
    const candidate = Buffer.from(signature, "utf8")
    // A different length can never be a match, and `timingSafeEqual` insists
    // on the same length.
    if (candidate.length !== expectedBuffer.length) return false
    return timingSafeEqual(candidate, expectedBuffer)
  })
}

/** The entitlement a Stripe subscription means. */
export interface StripeEntitlement {
  /** The member's uid, as Stripe's metadata carries it. */
  uid: string
  /** The band the plan belongs to, as Stripe's metadata carries it. */
  organizationId: string
  plan: "monthly" | "annual"
  /** The Stripe customer, for the billing portal later. */
  customerId: string
  /** The subscription's id, so a later webhook can find it again. */
  subscriptionId: string
  /** When the current period ends (ISO date), `null` when it never ends. */
  expiresAt: string | null
  /** True while the subscription is paying (not cancelled, not past due). */
  active: boolean
}

/**
 * Reads a Stripe subscription into what the entitlement needs.
 *
 * The uid comes from the **metadata** Stripe stored with the subscription —
 * never from the browser ✓ — and so does the band: the plan belongs to a
 * band, and the webhook has to know which one. A subscription without both
 * grants nothing at all.
 */
export const subscriptionFromStripe = (
  subscription: Record<string, unknown>,
): StripeEntitlement | null => {
  const metadata = (subscription.metadata ?? {}) as Record<string, unknown>
  const uid = typeof metadata.uid === "string" ? metadata.uid : ""
  const organizationId = typeof metadata.organizationId === "string" ? metadata.organizationId : ""
  const plan = metadata.plan === "annual" ? "annual" : metadata.plan === "monthly" ? "monthly" : null
  const id = typeof subscription.id === "string" ? subscription.id : ""
  if (!uid || !organizationId || !plan || !id) return null
  const customer = subscription.customer
  const customerId = typeof customer === "string" ? customer : ""
  const status = typeof subscription.status === "string" ? subscription.status : ""
  const currentPeriodEnd = Number(subscription.current_period_end ?? 0)
  const expiresAt =
    Number.isFinite(currentPeriodEnd) && currentPeriodEnd > 0
      ? new Date(currentPeriodEnd * 1000).toISOString().slice(0, 10)
      : null
  return {
    uid,
    organizationId,
    plan,
    customerId,
    subscriptionId: id,
    expiresAt,
    active: status === "active" || status === "trialing",
  }
}

/**
 * The Pro plan (roadmap #61). Pure — **zero firebase imports**, so the app
 * reads the shapes, the limits and the product ids through the `@/functions`
 * alias without dragging the Admin SDK into the bundle (the `notify.ts`
 * precedent).
 *
 * The entitlement is **server-written only**: the client never writes it, the
 * callable does, after the store has confirmed the purchase. The client only
 * ever *reads* it, so a phone that has been offline for a month still knows
 * what it is entitled to.
 */

/** The two plans. */
export type PlanId = "free" | "pro"

/** Where the purchase came from. */
export type EntitlementSource = "play" | "appstore" | "tip"

/**
 * The product ids the stores use. They are the contract between the app, the
 * Play Console and the callable — a purchase of an unknown product is never
 * granted, whatever the store says.
 *
 * On Play, a subscription is a **container** (`setuno_pro`) that holds one
 * **base plan** per period, and the sku the app asks the store for is the
 * **base plan id**, not the subscription's own id. So the monthly and the
 * yearly plans are two base plans of one subscription, and the tip is a
 * separate one-off product with its own id.
 */
export const PRO_PRODUCTS = {
  /** The subscription that holds the base plans (Play's container). */
  subscription: "setuno_pro",
  /** The month-to-month base plan — the sku the app asks for. */
  monthly: "monthly",
  /** The yearly base plan — the sku the app asks for. */
  annual: "annual",
  /** The optional tip (roadmap #64) — a consumable, never a plan. */
  tip: "setuno_tip",
} as const

export type ProProductId = (typeof PRO_PRODUCTS)[keyof typeof PRO_PRODUCTS]

/** The skus that grant the plan (the tip does not). */
export const SUBSCRIPTION_PRODUCTS: readonly string[] = [
  PRO_PRODUCTS.monthly,
  PRO_PRODUCTS.annual,
]

/** True when a product id is one the app knows about. */
export const isKnownProduct = (productId: string): boolean =>
  Object.values(PRO_PRODUCTS).includes(productId as ProProductId)

/**
 * What the free plan allows (roadmap #63: "Free: one band and a base
 * songbook; Pro: unlimited + extras").
 *
 * The song count is the one number the band can change: it lives here, in one
 * place, and the app reads it from here.
 */
export const FREE_LIMITS = {
  /** How many bands a free account may be in. */
  bands: 1,
  /** How many songs the free songbook holds. */
  songs: 50,
} as const

/** The entitlement document, written by the callable and read by the app. */
export interface Entitlement {
  plan: PlanId
  /** The product the purchase came from. */
  productId: string
  /** Where it came from. */
  source: EntitlementSource
  /** When the current period ends (ISO date). `null`: it never ends. */
  expiresAt: string | null
  /** When the entitlement was last refreshed (ISO date). */
  updatedAt: string
}

/** The entitlement every account has before it buys anything. */
export const freeEntitlement = (now: string): Entitlement => ({
  plan: "free",
  productId: "",
  source: "play",
  expiresAt: null,
  updatedAt: now,
})

/** True when the entitlement grants the Pro plan right now. */
export const isPro = (entitlement: Entitlement | null | undefined): boolean => {
  if (!entitlement || entitlement.plan !== "pro") return false
  if (!entitlement.expiresAt) return true
  // An expired subscription is not a Pro one: the expiry is compared as a
  // date, so the day it ends is still the last Pro day.
  return entitlement.expiresAt >= new Date().toISOString().slice(0, 10)
}

/**
 * Reads an entitlement document out of the store, healing anything it does
 * not like: a missing document is the free plan, and a document with an
 * unknown plan or a broken date is the free plan too (a broken entitlement
 * must never *grant* anything).
 */
export const mapEntitlement = (data: unknown, now: string): Entitlement => {
  if (!data || typeof data !== "object") return freeEntitlement(now)
  const raw = data as Record<string, unknown>
  const plan: PlanId = raw.plan === "pro" ? "pro" : "free"
  const source: EntitlementSource =
    raw.source === "appstore" || raw.source === "tip" ? raw.source : "play"
  const productId = typeof raw.productId === "string" ? raw.productId : ""
  const expiresAt =
    typeof raw.expiresAt === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw.expiresAt)
      ? raw.expiresAt.slice(0, 10)
      : null
  const updatedAt =
    typeof raw.updatedAt === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw.updatedAt)
      ? raw.updatedAt.slice(0, 10)
      : now
  return { plan, productId, source, expiresAt, updatedAt }
}

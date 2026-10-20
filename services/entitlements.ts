import { getFunctions, httpsCallable } from "@react-native-firebase/functions"

import { doc, firestore, onSnapshot, paths, type Unsubscribe } from "@/db/Fire"
import {
  FREE_LIMITS,
  isPro,
  mapEntitlement,
  type Entitlement,
  type PlanId,
} from "@/functions/src/entitlements"

/**
 * The Pro plan (roadmap #61).
 *
 * The entitlement is **server-written**: the `syncProPurchase` callable asks
 * the store whether the purchase is real and writes the document with the
 * Admin SDK. The client only ever reads it (the rules have no `allow write`
 * for it), so a phone can never grant itself the plan.
 *
 * A **missing** document is the free plan — a brand-new account has no
 * entitlement and does not need one.
 */

/** The document the entitlement lives under. */
const ENTITLEMENT_ID = "pro"

/** What the app needs to know about the member's plan. */
export interface PlanState {
  plan: PlanId
  /** True when the Pro perks apply right now. */
  isPro: boolean
  /** The free plan's limits, or `null` when the member is Pro. */
  limits: typeof FREE_LIMITS | null
  /** The product the plan was bought with. */
  productId: string
  /** When the current period ends (ISO date). `null`: it never ends. */
  expiresAt: string | null
}

const toPlanState = (entitlement: Entitlement): PlanState => {
  const pro = isPro(entitlement)
  return {
    plan: pro ? "pro" : "free",
    isPro: pro,
    limits: pro ? null : FREE_LIMITS,
    productId: entitlement.productId,
    expiresAt: entitlement.expiresAt,
  }
}

/** The plan of an account with no entitlement document. */
export const freePlanState = (): PlanState => ({
  plan: "free",
  isPro: false,
  limits: FREE_LIMITS,
  productId: "",
  expiresAt: null,
})

/**
 * Watches the member's entitlement.
 *
 * The listener is the whole story: the document is written by the callable
 * and read here, so a phone that has been offline for a month still knows
 * what it is entitled to the moment it comes back.
 */
export const subscribeEntitlement = (
  uid: string,
  onChange: (state: PlanState) => void,
): Unsubscribe => {
  if (!uid) {
    onChange(freePlanState())
    return () => undefined
  }
  return onSnapshot(
    doc(firestore, paths.userEntitlement(uid, ENTITLEMENT_ID)),
    (snapshot) => {
      const now = new Date().toISOString().slice(0, 10)
      onChange(toPlanState(mapEntitlement(snapshot.exists() ? snapshot.data() : null, now)))
    },
    // A document we cannot read is the free plan: failing closed never grants
    // anything, and the member can always try again.
    () => onChange(freePlanState()),
  )
}

/**
 * Hands a purchase to the server, which confirms it with the store.
 *
 * The phone never decides what it is entitled to — it only says what the
 * store gave it.
 */
export const syncPurchase = async (productId: string, purchaseToken: string): Promise<PlanState> => {
  const call = httpsCallable<{ productId: string; purchaseToken: string }, Entitlement>(
    getFunctions(),
    "syncProPurchase",
  )
  const response = await call({ productId, purchaseToken })
  const now = new Date().toISOString().slice(0, 10)
  return toPlanState(mapEntitlement(response.data, now))
}

/** Reads the plan once (the "restore purchases" flow, roadmap #62). */
export const fetchEntitlement = async (): Promise<PlanState> => {
  const call = httpsCallable<Record<string, never>, Entitlement>(getFunctions(), "getMyEntitlement")
  const response = await call({})
  const now = new Date().toISOString().slice(0, 10)
  return toPlanState(mapEntitlement(response.data, now))
}

/** One of the two plans, with what the store charges for it. */
export interface PlanOffer {
  plan: "monthly" | "annual"
  priceId: string
  /** The amount, in the currency's smallest unit. */
  amount: number
  currency: string
  /** The formatted price, as the store writes it ("€40.29"). */
  display: string
}

/**
 * The two plans and their prices — the **web** half of the plan (roadmap #61).
 *
 * The web buys from Stripe (Play Billing has no web implementation), so the
 * prices come from Stripe's own catalogue: the number the member sees is the
 * number Stripe charges.
 */
export const fetchPlanOffers = async (): Promise<PlanOffer[]> => {
  const call = httpsCallable<Record<string, never>, { offers: PlanOffer[] }>(
    getFunctions(),
    "getPlanOffers",
  )
  const response = await call({})
  return response.data.offers ?? []
}

/** Opens Stripe's Checkout for a plan and returns the URL to send the member to. */
export const startCheckout = async (plan: "monthly" | "annual"): Promise<string> => {
  const call = httpsCallable<{ plan: string }, { url: string }>(getFunctions(), "startCheckout")
  const response = await call({ plan })
  return response.data.url
}

/** Opens Stripe's billing portal (cancel, change the card). */
export const openBillingPortal = async (): Promise<string> => {
  const call = httpsCallable<Record<string, never>, { url: string }>(
    getFunctions(),
    "openBillingPortal",
  )
  const response = await call({})
  return response.data.url
}

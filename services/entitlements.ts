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
 * The entitlement lives on the **band**, not on the account: the band
 * subscribes (an admin buys it) and every member of it gets the perks — the
 * ads disappear on every member's device, the band's statistics open, and the
 * songbook stops having a ceiling. A per-account entitlement would have left
 * the band's songbook limit applying to the members who did not buy anything.
 *
 * It is **server-written**: the `syncProPurchase` callable asks the store
 * whether the purchase is real and writes the document with the Admin SDK, so
 * the client cannot write it at all. The client only ever *reads* it, so a
 * phone that has been offline for a month still knows what the band is
 * entitled to.
 *
 * A **missing** document is the free plan — a band that never subscribed does
 * not need one.
 */

/** What the app needs to know about the member's plan. */
export interface PlanState {
  plan: PlanId
  /** True when the Pro perks apply right now. */
  isPro: boolean
  /** The free plan's limits, or `null` when the band is Pro. */
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
  organizationId: string,
  onChange: (state: PlanState) => void,
): Unsubscribe => {
  if (!organizationId) {
    onChange(freePlanState())
    return () => undefined
  }
  return onSnapshot(
    doc(firestore, paths.organizationEntitlement(organizationId)),
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
export const syncPurchase = async (
  organizationId: string,
  productId: string,
  purchaseToken: string,
): Promise<PlanState> => {
  const call = httpsCallable<
    { organizationId: string; productId: string; purchaseToken: string },
    Entitlement
  >(getFunctions(), "syncProPurchase")
  const response = await call({ organizationId, productId, purchaseToken })
  const now = new Date().toISOString().slice(0, 10)
  return toPlanState(mapEntitlement(response.data, now))
}

/** Reads the plan once (the "restore purchases" flow, roadmap #62). */
export const fetchEntitlement = async (organizationId: string): Promise<PlanState> => {
  const call = httpsCallable<{ organizationId: string }, Entitlement>(
    getFunctions(),
    "getMyEntitlement",
  )
  const response = await call({ organizationId })
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
export const startCheckout = async (
  organizationId: string,
  plan: "monthly" | "annual",
): Promise<string> => {
  const call = httpsCallable<{ organizationId: string; plan: string }, { url: string }>(
    getFunctions(),
    "startCheckout",
  )
  const response = await call({ organizationId, plan })
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

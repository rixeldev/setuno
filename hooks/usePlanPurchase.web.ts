import { useCallback, useEffect, useState } from "react"

import type { PlanPurchaseApi, PlanProduct } from "@/hooks/usePlanPurchase"
import {
  fetchEntitlement,
  fetchPlanOffers,
  openBillingPortal,
  startCheckout,
} from "@/services/entitlements"

/**
 * The store's side of the Pro plan — **web** (roadmap #61).
 *
 * The web buys from **Stripe Checkout**: Play Billing has no web
 * implementation, so the native file talks to `expo-iap` and this one talks to
 * the same callables the webhook settles the entitlement with. Either way the
 * plan ends up in the **same** document, so it belongs to the account and not
 * to the device.
 *
 * The twin file is what keeps `expo-iap` — a native only module — out of the
 * web bundle.
 */
export const usePlanPurchase = (options: {
  /** The band the plan belongs to — a tip does not need one. */
  organizationId: string
  /** Called once the server has confirmed the purchase. */
  onPurchased: (productId: string) => void
  /** Called when the store or the server refuses. */
  onError: (message: string) => void
}): PlanPurchaseApi => {
  const [products, setProducts] = useState<PlanProduct[]>([])

  // The catalogue decides whether the plan can be bought here at all: until
  // the prices exist, the screen says so instead of offering a button that
  // cannot work.
  useEffect(() => {
    let cancelled = false
    void fetchPlanOffers()
      .then((offers) => {
        if (cancelled) return
        setProducts(
          offers.map((offer) => ({ id: offer.plan, price: offer.display })),
        )
      })
      .catch(() => {
        if (!cancelled) setProducts([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const buy = useCallback(
    async (productId: string): Promise<void> => {
      try {
        const url = await startCheckout(
          options.organizationId,
          productId as "monthly" | "annual",
        )
        // Stripe's Checkout is a hosted page: the browser goes there, pays and
        // comes back. The entitlement is written by the webhook meanwhile.
        if (typeof window !== "undefined") window.location.href = url
      } catch {
        options.onError("purchase-failed")
      }
    },
    [options],
  )

  const restore = useCallback(async (): Promise<{ productId: string; purchaseToken: string }[]> => {
    // Stripe is the source of truth and the webhook has already settled the
    // entitlement; asking the server again is all a "restore" has to do.
    try {
      await fetchEntitlement(options.organizationId)
    } catch {
      // Nothing to restore (or the store is unreachable) — the screen says so.
    }
    return []
  }, [options.organizationId])

  const manage = useCallback(async (): Promise<void> => {
    try {
      const url = await openBillingPortal()
      if (typeof window !== "undefined") window.location.href = url
    } catch {
      options.onError("store-unavailable")
    }
  }, [options])

  return {
    connected: products.length > 0,
    products,
    // No tip on the web yet: the store's company details are still being set
    // up, and the tip is a one-time product that would need its own Stripe
    // price.
    tip: null,
    buy,
    tipNow: async () => {
      options.onError("store-unavailable")
    },
    restore,
    manage,
  }
}

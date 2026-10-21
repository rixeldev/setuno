import { useCallback, useEffect, useState } from "react"
import { getAvailablePurchases, useIAP } from "expo-iap"

import { PRO_PRODUCTS } from "@/functions/src/entitlements"
import { planOffersFromProducts } from "@/libs/planOffers"
import { syncPurchase } from "@/services/entitlements"

/**
 * The store's side of the Pro plan (roadmap #61, native only).
 *
 * The purchase is confirmed **on the server**: the phone hands the store's
 * token to the callable, and the callable asks Google whether it is a real,
 * paid purchase. The phone never grants itself anything.
 *
 * Two rules the store imposes and this hook has to respect:
 *
 * - **The catalogue is queried only once connected.** `useIAP` connects on
 *   mount and `fetchProducts` throws when it is not ready yet, so a query fired
 *   on mount could answer "no products" for a perfectly configured store.
 * - **A subscription is bought by base plan, not by product.** Play Billing 5+
 *   sells `setuno_pro` and its base plans (`monthly`, `annual`); the base plan
 *   id alone is not a sku, and a purchase without its offer token is refused.
 *   `libs/planOffers.ts` turns the catalogue into the plans the screen shows.
 *
 * The web build has no store to talk to — `usePlanPurchase.web.ts` is the
 * no-op twin, so the web bundle never imports `expo-iap` (which is native
 * only).
 */

/** A plan product the store offers. */
export interface PlanProduct {
  id: string
  /** The price, formatted by the store ("€4.99"). */
  price: string
}

export interface PlanPurchaseApi {
  /** True when the store answered. */
  connected: boolean
  /** The plan products the store offers right now. */
  products: PlanProduct[]
  /** The optional tip (roadmap #64), with what it costs. */
  tip: PlanProduct | null
  /**
   * Why the catalogue came back empty, when it did: the store's own code (or
   * message). `null` while everything is fine — the plan screen prints it under
   * "not offered" so a misconfigured store is diagnosable instead of silent.
   */
  error: string | null
  /** Starts the purchase of a product. */
  buy: (productId: string) => Promise<void>
  /** Buys the tip — a consumable that grants nothing. */
  tipNow: () => Promise<void>
  /** The purchases the store still knows about (the restore flow, #62). */
  restore: () => Promise<{ productId: string; purchaseToken: string }[]>
  /** Opens the store's own subscription screen. */
  manage: () => Promise<void>
  /** Retries the store connection (the plan screen offers it when it failed). */
  reconnect: () => Promise<void>
}

/** The store's reason, short enough to print in a caption. */
const storeErrorCode = (cause: unknown): string => {
  if (cause && typeof cause === "object") {
    const code = (cause as { code?: unknown }).code
    if (typeof code === "string" && code.length > 0) return code.slice(0, 120)
    const message = (cause as { message?: unknown }).message
    if (typeof message === "string" && message.length > 0) return message.slice(0, 120)
  }
  return "store-unavailable"
}

export const usePlanPurchase = (options: {
  /** The band the plan belongs to — a tip does not need one. */
  organizationId: string
  /** Called once the server has confirmed the purchase. */
  onPurchased: (productId: string) => void
  /** Called when the store or the server refuses. */
  onError: (message: string) => void
}): PlanPurchaseApi => {
  const [error, setError] = useState<string | null>(null)

  const {
    connected,
    products: storeProducts,
    subscriptions,
    fetchProducts,
    requestPurchase: request,
    finishTransaction,
    restorePurchases,
    reconnect: reconnectStore,
  } = useIAP({
    onPurchaseSuccess: (purchase) => {
      const token = purchase.purchaseToken
      if (!token) {
        options.onError("purchase-token")
        return
      }
      void syncPurchase(options.organizationId, purchase.productId, token)
        .then(() => finishTransaction({ purchase }))
        .then(() => options.onPurchased(purchase.productId))
        .catch(() => options.onError("purchase-failed"))
    },
    onPurchaseError: () => options.onError("purchase-failed"),
    // A connection that throws (no Play Store, billing unavailable, a signature
    // the store refuses) is the reason the catalogue is empty, so it is kept
    // where the screen can show it.
    onError: (cause) => setError(storeErrorCode(cause)),
  })

  // The store's catalogue decides whether the plan can be bought here: the
  // products are created in the Play Console, so until they are, the screen
  // says so instead of offering a button that cannot work.
  useEffect(() => {
    if (!connected) return
    let cancelled = false
    void (async () => {
      try {
        await fetchProducts({
          // The subscription container, plus the plan ids in case this store
          // was configured with one product per period instead of base plans.
          skus: [PRO_PRODUCTS.subscription, PRO_PRODUCTS.monthly, PRO_PRODUCTS.annual],
          type: "subs",
        })
        // The tip is a **one-time product**, a different kind of thing than the
        // subscriptions, so the store is asked for it separately.
        await fetchProducts({ skus: [PRO_PRODUCTS.tip], type: "in-app" })
        if (!cancelled) setError(null)
      } catch (cause) {
        if (!cancelled) setError(storeErrorCode(cause))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [connected, fetchProducts])

  const offers = planOffersFromProducts(subscriptions)
  const products: PlanProduct[] = offers.map((offer) => ({ id: offer.id, price: offer.price }))

  const tipProduct = storeProducts.find((product) => product.id === PRO_PRODUCTS.tip)
  const tip: PlanProduct | null = tipProduct
    ? { id: tipProduct.id, price: tipProduct.displayPrice }
    : null

  const buy = useCallback(
    async (productId: string): Promise<void> => {
      const offer = offers.find((candidate) => candidate.id === productId)
      if (!offer) {
        options.onError("store-unavailable")
        return
      }
      try {
        // The Google variant carries the sku **and the base plan's offer
        // token**; Play Billing 5+ will not open a subscription flow without
        // it. The iOS store carries its own product ids, which do not exist
        // until iOS ships.
        await request({
          request: {
            google: {
              skus: [offer.productId],
              subscriptionOffers: [{ sku: offer.productId, offerToken: offer.offerToken }],
            },
          },
          type: "subs",
        })
      } catch {
        options.onError("purchase-failed")
      }
    },
    [offers, request, options],
  )

  const tipNow = useCallback(async (): Promise<void> => {
    try {
      await request({
        request: { google: { skus: [PRO_PRODUCTS.tip] } },
        type: "in-app",
      })
    } catch {
      options.onError("purchase-failed")
    }
  }, [request, options])

  const restore = useCallback(async (): Promise<{ productId: string; purchaseToken: string }[]> => {
    try {
      await restorePurchases()
      const purchases = await getAvailablePurchases()
      return purchases
        .map((purchase) => ({
          productId: purchase.productId,
          purchaseToken: purchase.purchaseToken ?? "",
        }))
        .filter((purchase) => purchase.purchaseToken.length > 0)
    } catch {
      return []
    }
  }, [restorePurchases])

  return {
    connected,
    products,
    tip,
    error,
    buy,
    tipNow,
    restore,
    manage: async () => {
      const { deepLinkToSubscriptions } = await import("expo-iap")
      await deepLinkToSubscriptions()
    },
    reconnect: async () => {
      await reconnectStore()
    },
  }
}

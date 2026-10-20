import { useCallback, useEffect, useState } from "react"
import { fetchProducts, getAvailablePurchases, useIAP } from "expo-iap"

import { PRO_PRODUCTS } from "@/functions/src/entitlements"
import { syncPurchase } from "@/services/entitlements"

/**
 * The store's side of the Pro plan (roadmap #61, native only).
 *
 * The purchase is confirmed **on the server**: the phone hands the store's
 * token to the callable, and the callable asks Google whether it is a real,
 * paid purchase. The phone never grants itself anything.
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
  /** Starts the purchase of a product. */
  buy: (productId: string) => Promise<void>
  /** Buys the tip — a consumable that grants nothing. */
  tipNow: () => Promise<void>
  /** The purchases the store still knows about (the restore flow, #62). */
  restore: () => Promise<{ productId: string; purchaseToken: string }[]>
  /** Opens the store's own subscription screen. */
  manage: () => Promise<void>
}

export const usePlanPurchase = (options: {
  /** The band the plan belongs to — a tip does not need one. */
  organizationId: string
  /** Called once the server has confirmed the purchase. */
  onPurchased: (productId: string) => void
  /** Called when the store or the server refuses. */
  onError: (message: string) => void
}): PlanPurchaseApi => {
  const [products, setProducts] = useState<PlanProduct[]>([])
  const [tip, setTip] = useState<PlanProduct | null>(null)

  const { connected, requestPurchase: request, finishTransaction, restorePurchases } = useIAP({
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
  })

  // The store's catalogue decides whether the plan can be bought here: the
  // products are created in the Play Console, so until they are, the screen
  // says so instead of offering a button that cannot work.
  useEffect(() => {
    let cancelled = false
    void fetchProducts({
      skus: [PRO_PRODUCTS.monthly, PRO_PRODUCTS.annual],
      type: "subs",
    })
      .then((result) => {
        if (cancelled) return
        const list = Array.isArray(result) ? result : []
        setProducts(
          list.map((product) => ({
            id: "id" in product ? product.id : "",
            price: "displayPrice" in product ? product.displayPrice : "",
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setProducts([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // The tip is a **one-time product**, a different kind of thing than the
  // subscriptions, so the store is asked for it separately.
  useEffect(() => {
    let cancelled = false
    void fetchProducts({ skus: [PRO_PRODUCTS.tip], type: "in-app" })
      .then((result) => {
        if (cancelled) return
        const list = Array.isArray(result) ? result : []
        const product = list[0]
        if (!product) return
        setTip({
          id: "id" in product ? product.id : PRO_PRODUCTS.tip,
          price: "displayPrice" in product ? product.displayPrice : "",
        })
      })
      .catch(() => {
        if (!cancelled) setTip(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const buy = useCallback(
    async (productId: string): Promise<void> => {
      try {
        // The Google variant carries the skus; the iOS one is left out until
        // iOS ships (the plan is a subscription there too, but the App Store
        // product ids are the owner's to create).
        await request({ request: { google: { skus: [productId] } }, type: "subs" })
      } catch {
        options.onError("purchase-failed")
      }
    },
    [request, options],
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
    buy,
    tipNow,
    restore,
    manage: async () => {
      const { deepLinkToSubscriptions } = await import("expo-iap")
      await deepLinkToSubscriptions()
    },
  }
}

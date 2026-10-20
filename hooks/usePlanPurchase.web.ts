import { useCallback, useState } from "react"

import type { PlanPurchaseApi, PlanProduct } from "@/hooks/usePlanPurchase"

/**
 * The store's side of the Pro plan — **web** (roadmap #61).
 *
 * There is no store to talk to in a browser, so the whole API is a no-op: the
 * catalogue is empty (the screen says the plan is not offered here) and the
 * purchase does nothing. The twin file is what keeps `expo-iap` — a native
 * only module — out of the web bundle.
 */
export const usePlanPurchase = (options: {
  onPurchased: (productId: string) => void
  onError: (message: string) => void
}): PlanPurchaseApi => {
  const [products] = useState<PlanProduct[]>([])

  const buy = useCallback(async (): Promise<void> => {
    options.onError("store-unavailable")
  }, [options])

  const restore = useCallback(
    async (): Promise<{ productId: string; purchaseToken: string }[]> => [],
    [],
  )

  return {
    connected: false,
    products,
    buy,
    restore,
    manage: async () => undefined,
  }
}

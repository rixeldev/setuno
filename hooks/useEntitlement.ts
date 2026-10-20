import { useEffect, useState } from "react"

import { useAuth } from "@/hooks/useAuth"
import { freePlanState, subscribeEntitlement, type PlanState } from "@/services/entitlements"

/**
 * The member's plan (roadmap #61).
 *
 * The entitlement is read, never written: the callable owns it and the rules
 * refuse a client write. A phone that has been offline for a month still
 * knows what it is entitled to the moment the document lands.
 *
 * The first render answers the **free** plan — the safe answer, since it
 * grants nothing — and the real one arrives with the first snapshot.
 */
export const useEntitlement = (): PlanState => {
  const { profile } = useAuth()
  const uid = profile?.uid ?? ""
  const [state, setState] = useState<PlanState>(() => freePlanState())

  useEffect(() => {
    const unsubscribe = subscribeEntitlement(uid, setState)
    return unsubscribe
  }, [uid])

  return state
}

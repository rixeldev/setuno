import { useEffect, useState } from "react"

import { useOrganization } from "@/hooks/useOrganization"
import { freePlanState, subscribeEntitlement, type PlanState } from "@/services/entitlements"

/**
 * The band's plan (roadmap #61).
 *
 * The entitlement lives on the **band**, so this follows the band the member
 * is looking at: switching bands switches the plan ✓. It is read, never
 * written: the callable owns it and the rules refuse a client write.
 *
 * The first render answers the **free** plan — the safe answer, since it
 * grants nothing — and the real one arrives with the first snapshot.
 */
export const useEntitlement = (): PlanState => {
  const { organizationId } = useOrganization()
  const [state, setState] = useState<PlanState>(() => freePlanState())

  useEffect(() => {
    const unsubscribe = subscribeEntitlement(organizationId ?? "", setState)
    return unsubscribe
  }, [organizationId])

  return state
}

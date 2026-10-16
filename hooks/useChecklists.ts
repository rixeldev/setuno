import { useEffect, useState } from "react"

import { subscribeChecklist, subscribeChecklists } from "@/services/checklists"
import { toFriendlyError } from "@/services/errors"
import type { ChecklistTemplate } from "@/interfaces"

const EMPTY: ChecklistTemplate[] = []

/**
 * The band's reusable checklists (roadmap #49), tagged with the band like
 * `usePolls` — a stale list can never leak across bands, and the effect
 * body never syncs state.
 */
export function useChecklists(organizationId: string | null) {
  const [state, setState] = useState<{ key: string; lists: ChecklistTemplate[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const lists = state && state.key === (organizationId ?? "") ? state.lists : EMPTY
  const loading = organizationId !== null && state === null

  useEffect(() => {
    if (!organizationId) return
    return subscribeChecklists(
      organizationId,
      (items) => {
        setError(null)
        setState({ key: organizationId, lists: items })
      },
      (cause) => setError(toFriendlyError(cause, "We couldn't load the checklists.")),
    )
  }, [organizationId])

  return { lists, loading, error }
}

/** One checklist, for the edit form (null while it loads or if it is gone). */
export function useChecklist(organizationId: string | null, checklistId: string | null) {
  const key = organizationId && checklistId ? `${organizationId}:${checklistId}` : null
  const [state, setState] = useState<{ key: string; list: ChecklistTemplate | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const list = state && state.key === key ? state.list : null
  const loading = key !== null && state === null

  useEffect(() => {
    if (!key || !organizationId || !checklistId) return
    return subscribeChecklist(
      organizationId,
      checklistId,
      (item) => {
        setError(null)
        setState({ key, list: item })
      },
      (cause) => setError(toFriendlyError(cause, "We couldn't load this checklist.")),
    )
  }, [key, organizationId, checklistId])

  return { list, loading, error }
}

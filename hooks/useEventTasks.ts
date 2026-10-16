import { useEffect, useState } from "react"

import { subscribeEventTasks } from "@/services/eventLogistics"
import { toFriendlyError } from "@/services/errors"
import type { EventTask } from "@/interfaces"

const EMPTY: EventTask[] = []

/**
 * One event's "who brings what" tasks (roadmap #47), tagged with the band and
 * event like `useCollections` tags with the uid — a stale list can never leak
 * across events, and the effect body never syncs state. The RSVP map needs no
 * hook: it rides the performance document `useOrgData` already subscribes.
 */
export function useEventTasks(
  organizationId: string | null,
  performanceId: string | null,
) {
  const key =
    organizationId && performanceId ? `${organizationId}:${performanceId}` : null
  const [state, setState] = useState<{ key: string; tasks: EventTask[] } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  const tasks = state && state.key === key ? state.tasks : EMPTY
  const loading = key !== null && state === null

  useEffect(() => {
    if (!key || !organizationId || !performanceId) return
    return subscribeEventTasks(
      organizationId,
      performanceId,
      (items) => {
        setError(null)
        setState({ key, tasks: items })
      },
      (cause) =>
        setError(toFriendlyError(cause, "We couldn't load this event's tasks.")),
    )
  }, [key, organizationId, performanceId])

  return { tasks, loading, error }
}

import { useEffect, useState } from "react"

import { subscribeEventComments } from "@/services/eventComments"
import type { EventComment } from "@/interfaces"

const EMPTY: EventComment[] = []

/**
 * One event's discussion thread (roadmap #90), tagged with the band and the
 * event like `useEventTasks` — a stale thread can never leak across events, and
 * the effect body never syncs state. The failure is tagged too, so an event
 * that could not load its thread never shows that error on the next one, and it
 * comes back as the raw cause (not a formatted string) so the screen can hand
 * `toFriendlyError` its localized fallback.
 */
export function useEventComments(
  organizationId: string | null,
  performanceId: string | null,
) {
  const key =
    organizationId && performanceId ? `${organizationId}:${performanceId}` : null
  const [state, setState] = useState<{ key: string; comments: EventComment[] } | null>(
    null,
  )
  const [failure, setFailure] = useState<{ key: string; cause: unknown } | null>(null)

  const comments = state && state.key === key ? state.comments : EMPTY
  const error = failure && failure.key === key ? failure.cause : null
  const loading = key !== null && state === null

  useEffect(() => {
    if (!key || !organizationId || !performanceId) return
    return subscribeEventComments(
      organizationId,
      performanceId,
      (next) => {
        setFailure(null)
        setState({ key, comments: next })
      },
      (cause) => setFailure({ key, cause }),
    )
  }, [key, organizationId, performanceId])

  return { comments, loading, error }
}

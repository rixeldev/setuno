import { useEffect, useState } from "react"

import { subscribeSuggestionComments } from "@/services/suggestionComments"
import type { SuggestionComment } from "@/interfaces"

const EMPTY: SuggestionComment[] = []

/**
 * One suggestion's discussion thread (roadmap #55), tagged with the band and
 * the suggestion like `useEventTasks` tags with the band and event — a stale
 * thread can never leak across suggestions, and the effect body never syncs
 * state. The error comes back as the raw cause (not a formatted string) so
 * the screen can hand `toFriendlyError` its localized fallback.
 */
export function useSuggestionComments(
  organizationId: string | null,
  suggestionId: string | null,
) {
  const key = organizationId && suggestionId ? `${organizationId}:${suggestionId}` : null
  const [state, setState] = useState<{ key: string; comments: SuggestionComment[] } | null>(
    null,
  )
  const [error, setError] = useState<unknown>(null)

  const comments = state && state.key === key ? state.comments : EMPTY
  const loading = key !== null && state === null

  useEffect(() => {
    if (!key || !organizationId || !suggestionId) return
    return subscribeSuggestionComments(
      organizationId,
      suggestionId,
      (items) => {
        setError(null)
        setState({ key, comments: items })
      },
      (cause) => setError(cause),
    )
  }, [key, organizationId, suggestionId])

  return { comments, loading, error }
}

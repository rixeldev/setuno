import { useEffect, useState } from "react"

import { subscribeJoinRequests, subscribeMyJoinRequests } from "@/services/joinRequests"
import { toFriendlyError } from "@/services/errors"
import type { JoinRequest } from "@/interfaces"

const EMPTY: JoinRequest[] = []

/**
 * The caller's own asks across every band (roadmap #60), tagged with the uid
 * like `useCollections` — a stale list can never leak across accounts, and the
 * effect body never syncs state.
 */
export function useMyJoinRequests(requesterUid: string | null) {
  const [state, setState] = useState<{ uid: string; requests: JoinRequest[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requests = state && state.uid === requesterUid ? state.requests : EMPTY

  useEffect(() => {
    if (!requesterUid) return
    return subscribeMyJoinRequests(
      requesterUid,
      (items) => {
        setError(null)
        setState({ uid: requesterUid, requests: items })
      },
      (cause) => setError(toFriendlyError(cause, "We couldn't load your requests.")),
    )
  }, [requesterUid])

  return { requests, error }
}

/**
 * The band's live queue of asks for the members screen (admins review).
 * Callers pass `null` for anyone who is not an admin — the rules would deny
 * the listener, and the app never opens one they would reject (#59's law).
 */
export function useJoinRequestQueue(organizationId: string | null) {
  const [state, setState] = useState<{ organizationId: string; requests: JoinRequest[] } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  const requests = state && state.organizationId === organizationId ? state.requests : EMPTY
  const loading = organizationId !== null && state === null

  useEffect(() => {
    if (!organizationId) return
    return subscribeJoinRequests(
      organizationId,
      (items) => {
        setError(null)
        setState({ organizationId, requests: items })
      },
      (cause) => setError(toFriendlyError(cause, "We couldn't load join requests.")),
    )
  }, [organizationId])

  return { requests, loading, error }
}

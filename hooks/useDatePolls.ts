import { useEffect, useState } from "react"

import {
  subscribePoll,
  subscribePolls,
  subscribePollVotes,
} from "@/services/datePolls"
import { toFriendlyError } from "@/services/errors"
import type { DatePoll, PollVote } from "@/interfaces"

const EMPTY_POLLS: DatePoll[] = []
const EMPTY_VOTES: PollVote[] = []

/**
 * The band's date polls (roadmap #48), tagged with the band like
 * `useCollections` tags with the uid — a stale list can never leak across
 * bands, and the effect body never syncs state.
 */
export function usePolls(organizationId: string | null) {
  const [state, setState] = useState<{ key: string; polls: DatePoll[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const polls = state && state.key === (organizationId ?? "") ? state.polls : EMPTY_POLLS
  const loading = organizationId !== null && state === null

  useEffect(() => {
    if (!organizationId) return
    return subscribePolls(
      organizationId,
      (items) => {
        setError(null)
        setState({ key: organizationId, polls: items })
      },
      (cause) => setError(toFriendlyError(cause, "We couldn't load the polls.")),
    )
  }, [organizationId])

  return { polls, loading, error }
}

/** One poll, for the detail screen (null while it loads or if it is gone). */
export function usePoll(organizationId: string | null, pollId: string | null) {
  const key = organizationId && pollId ? `${organizationId}:${pollId}` : null
  const [state, setState] = useState<{ key: string; poll: DatePoll | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const poll = state && state.key === key ? state.poll : null
  const loading = key !== null && state === null

  useEffect(() => {
    if (!key || !organizationId || !pollId) return
    return subscribePoll(
      organizationId,
      pollId,
      (item) => {
        setError(null)
        setState({ key, poll: item })
      },
      (cause) => setError(toFriendlyError(cause, "We couldn't load this poll.")),
    )
  }, [key, organizationId, pollId])

  return { poll, loading, error }
}

/** Every member's availability under one poll, tagged the same way. */
export function usePollVotes(organizationId: string | null, pollId: string | null) {
  const key = organizationId && pollId ? `${organizationId}:${pollId}` : null
  const [state, setState] = useState<{ key: string; votes: PollVote[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const votes = state && state.key === key ? state.votes : EMPTY_VOTES
  const loading = key !== null && state === null

  useEffect(() => {
    if (!key || !organizationId || !pollId) return
    return subscribePollVotes(
      organizationId,
      pollId,
      (items) => {
        setError(null)
        setState({ key, votes: items })
      },
      (cause) => setError(toFriendlyError(cause, "We couldn't load the votes.")),
    )
  }, [key, organizationId, pollId])

  return { votes, loading, error }
}

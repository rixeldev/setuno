import type { DatePoll, DatePollOption, PollVote } from "@/interfaces"
import { toMillis } from "@/interfaces/timestamp"
import { ISO_DATE_PATTERN, TIME_PATTERN } from "@/libs/validation"

/**
 * Date polls (roadmap #48), pure: candidate dates, each member's availability
 * and the winner. No React, no Firestore — the service maps untrusted
 * documents through these functions, so invalid stored data self-heals on
 * read and the tally/winner maths every device must agree on lives here,
 * unit-tested (the `calendarView`/`showLog` precedent).
 */

/** Longest a poll title may run (the rules pin the same number). */
export const POLL_TITLE_MAX = 120

/** A poll needs at least two candidate dates; the rules pin the cap. */
export const POLL_OPTION_MIN = 2
export const POLL_OPTION_MAX = 10

const POLL_NOTE_MAX = 140

/** Trims and bounds a poll title; empty means "nothing to store". */
export const pollTitle = (value: string): string =>
  value.trim().slice(0, POLL_TITLE_MAX)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const cleanNote = (value: unknown): string =>
  typeof value === "string" ? value.slice(0, POLL_NOTE_MAX) : ""

/**
 * Sanitizes a stored (or about-to-be-written) option list: only well-formed
 * entries survive, ids are deduplicated (a repeated id would double-count
 * votes), the list is sorted canonically and capped. Rules cannot iterate a
 * list, so this is the twin of the shape they pin (the `markers` precedent).
 */
export const mapPollOptions = (raw: unknown): DatePollOption[] => {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const options: DatePollOption[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) continue
    const id = typeof entry.id === "string" ? entry.id : ""
    const date = typeof entry.date === "string" ? entry.date : ""
    if (id.length === 0 || seen.has(id)) continue
    if (!ISO_DATE_PATTERN.test(date)) continue
    const time = typeof entry.time === "string" && TIME_PATTERN.test(entry.time) ? entry.time : ""
    seen.add(id)
    options.push({ id, date, time, note: cleanNote(entry.note) })
  }
  return sortPollOptions(options).slice(0, POLL_OPTION_MAX)
}

/** The canonical order every screen renders: date, then time, then id. */
export const sortPollOptions = (options: readonly DatePollOption[]): DatePollOption[] =>
  [...options].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id),
  )

/**
 * The vote toggle: pure, so the sheet and any future caller share it. The
 * whole chosen list is written to the member's own doc on save — no array
 * union, so two devices voting at once for the *same* member stay consistent
 * (the favorites toggle's contract verbatim).
 */
export const toggleOption = (optionIds: readonly string[], optionId: string): string[] =>
  optionIds.includes(optionId)
    ? optionIds.filter((id) => id !== optionId)
    : [...optionIds, optionId]

/**
 * A stored vote's raw shape: strings only, deduplicated, capped. The service
 * maps documents through this; the *content* check against the poll's own
 * options is `sanitizeVoteOptionIds` below, which the UI runs on read.
 */
export const cleanVoteIds = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  for (const id of raw) {
    if (typeof id === "string" && id.length > 0) seen.add(id)
  }
  return [...seen].slice(0, POLL_OPTION_MAX)
}

/**
 * A stored vote cleaned against the poll's own options: unknown ids are
 * dropped (an edited poll can orphan them), duplicates collapse, and the
 * result follows the poll's canonical order.
 */
export const sanitizeVoteOptionIds = (raw: unknown, options: readonly DatePollOption[]): string[] => {
  const chosen = new Set(cleanVoteIds(raw))
  return options.filter((option) => chosen.has(option.id)).map((option) => option.id)
}

/**
 * Votes per option id. A repeated id inside one vote counts once, and ids no
 * longer held by any option count for nothing — the tally and the winner can
 * never be moved by stale data.
 */
export const tallyVotes = (
  options: readonly DatePollOption[],
  votes: readonly PollVote[],
): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const option of options) counts[option.id] = 0
  for (const vote of votes) {
    for (const id of new Set(vote.optionIds)) {
      if (id in counts) counts[id] += 1
    }
  }
  return counts
}

/** The uids that marked one date as available (the detail screen's names). */
export const votersForOption = (votes: readonly PollVote[], optionId: string): string[] =>
  votes.filter((vote) => vote.optionIds.includes(optionId)).map((vote) => vote.uid)

/**
 * The date that won: most votes, ties broken by the **earliest** date (the
 * canonical order scans first and only a strictly larger count replaces it),
 * and `null` when nobody voted at all — closing a poll with no votes picks
 * nothing rather than inventing a night.
 */
export const pollWinner = (
  options: readonly DatePollOption[],
  votes: readonly PollVote[],
): DatePollOption | null => {
  if (options.length === 0) return null
  const counts = tallyVotes(options, votes)
  let best: DatePollOption | null = null
  let bestCount = 0
  for (const option of sortPollOptions(options)) {
    const count = counts[option.id] ?? 0
    if (count > bestCount) {
      best = option
      bestCount = count
    }
  }
  return best
}

/** Open polls first (newest first inside each group), then the closed ones. */
export const sortPolls = (polls: readonly DatePoll[]): DatePoll[] =>
  [...polls].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1
    // `toMillis` tolerates a queued local `Date` as well as a stored stamp.
    const byTime = (toMillis(b.createdAt) ?? 0) - (toMillis(a.createdAt) ?? 0)
    if (byTime !== 0) return byTime
    return a.id.localeCompare(b.id)
  })

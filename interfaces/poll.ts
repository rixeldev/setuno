import type { TimestampLike } from "./timestamp"

export type DatePollStatus = "open" | "closed"

/**
 * One candidate date of a poll (roadmap #48). `date` follows the same
 * `yyyy-mm-dd` convention as `Performance.date`, `time` the same `HH:mm`
 * 24h one, both optional-empty; `note` is a free cue ("outdoor stage, needs
 * the van").
 */
export interface DatePollOption {
  /** Client-generated stable id, so votes survive a date edit's reorder. */
  id: string
  date: string
  time: string
  note: string
}

/**
 * "Which date works?" (roadmap #48): member-proposed, member-voted, and the
 * winner turns into an event. Lives in the organization's `datePolls`
 * subcollection — the band votes inside the org, no public links.
 */
export interface DatePoll {
  id: string
  organizationId: string
  title: string
  /** 2..10 candidate dates, sorted by date then time on every read. */
  options: DatePollOption[]
  status: DatePollStatus
  /** The winning option's id, stamped when an admin closes the poll. */
  winningOptionId: string
  /** Event created from the winner, "" until an admin turns it into one. */
  createdEventId: string
  createdBy: string
  /** Client time on purpose (the task/version precedent): the list orders */
  /** itself newest-first and must survive an offline create. */
  createdAt: TimestampLike
  updatedAt: TimestampLike
}

/**
 * One member's availability, their own document under the poll — doc id =
 * uid, exactly the favorites shape: a member owns their answer alone, so two
 * votes at once can never clobber each other and nobody can vote for anyone
 * else (the rules pin `request.auth.uid == voterUid`).
 */
export interface PollVote {
  uid: string
  /** Ids of the dates this member can make; unknown ids are ignored on read. */
  optionIds: string[]
  updatedAt: TimestampLike
}

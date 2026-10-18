import type { TimestampLike } from "./timestamp"

export type JoinRequestStatus = "pending" | "approved" | "rejected"

/**
 * A musician asking to join an opt-in band (roadmap #60). The document lives at
 * `organizations/{organizationId}/joinRequests/{uid}` — the id is the
 * requester's own uid — and carries only what the admins need to recognise
 * them: their name, their email and an optional note. Approving turns the ask
 * into the band's ordinary invitation, so membership keeps the one rule it has
 * always had: only the account's own identity can join.
 */
export interface JoinRequest {
  uid: string
  /** The band this ask belongs to (parsed from the document path, never stored). */
  organizationId: string
  displayName: string
  email: string
  note: string
  status: JoinRequestStatus
  createdAt: TimestampLike
  reviewedBy: string | null
  reviewedByName: string | null
  reviewedAt: TimestampLike | null
}

/**
 * The only thing a non-member may read in the whole app: the name of a band
 * that chose to be discoverable (roadmap #60). Emails, uids and rosters are
 * deliberately absent — the document's existence at
 * `discoverable/{organizationId}` *is* the band's consent.
 */
export interface DiscoverableOrganization {
  id: string
  name: string
}

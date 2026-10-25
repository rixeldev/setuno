import type { TimestampLike } from "./timestamp"

export type ActivityType =
  | "organization_created"
  | "organization_updated"
  | "member_added"
  | "member_removed"
  | "member_role_changed"
  | "member_instruments_changed"
  | "invitation_sent"
  | "invitation_accepted"
  | "invitation_revoked"
  | "song_created"
  | "song_updated"
  | "song_duplicated"
  | "song_merged"
  | "song_deleted"
  | "song_trashed"
  | "song_restored"
  | "suggestion_created"
  | "suggestion_accepted"
  | "suggestion_rejected"
  | "suggestion_commented"
  | "setlist_created"
  | "setlist_updated"
  | "setlist_deleted"
  | "performance_created"
  | "performance_updated"
  | "performance_deleted"
  /** One band-wide import run (#38) instead of N per-item events. */
  | "bulk_imported"

export interface ActivityEvent {
  id: string
  organizationId: string
  type: ActivityType
  /** Rendered message, e.g. `Rixel added "Wonderwall"`. */
  message: string
  actorId: string
  actorName: string
  targetType: "organization" | "member" | "song" | "suggestion" | "setlist" | "performance"
  targetId: string | null
  createdAt: TimestampLike
}
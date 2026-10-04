import type { TimestampLike } from "./timestamp"

export type ActivityType =
  | "organization_created"
  | "organization_updated"
  | "member_added"
  | "member_removed"
  | "member_role_changed"
  | "invitation_sent"
  | "invitation_accepted"
  | "invitation_revoked"
  | "song_created"
  | "song_updated"
  | "song_deleted"
  | "suggestion_created"
  | "suggestion_accepted"
  | "suggestion_rejected"
  | "setlist_created"
  | "setlist_updated"
  | "setlist_deleted"
  | "performance_created"
  | "performance_updated"
  | "performance_deleted"

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
import type { TimestampLike } from "./timestamp"

export type OrganizationRole = "admin" | "member"

export interface Organization {
  id: string
  name: string
  description: string
  logoURL: string | null
  /** Firebase uid of the owner (always an admin). */
  ownerId: string
  createdAt: TimestampLike
  updatedAt: TimestampLike
}

export interface OrganizationMember {
  uid: string
  displayName: string
  email: string
  photoURL: string | null
  role: OrganizationRole
  joinedAt: TimestampLike
  /** Invited by this uid when the member joined through an invitation. */
  invitedBy: string | null
}

export interface OrganizationInput {
  name: string
  description: string
  logoURL?: string | null
}

export type InvitationStatus = "pending" | "accepted" | "revoked"

export interface Invitation {
  /** Document id is the lowercase invited email. */
  id: string
  organizationId: string
  organizationName: string
  email: string
  role: OrganizationRole
  status: InvitationStatus
  invitedBy: string
  invitedByName: string
  createdAt: TimestampLike
  respondedAt: TimestampLike | null
}

/** Compact organization reference used by pickers and the org switcher. */
export interface OrganizationRef {
  id: string
  name: string
  role: OrganizationRole
  logoURL: string | null
}

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  admin: "Admin",
  member: "Member",
}
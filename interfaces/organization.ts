import type { TimestampLike } from "./timestamp"

export type OrganizationRole = "admin" | "member" | "guest"

export interface Organization {
  id: string
  name: string
  description: string
  logoURL: string | null
  /**
   * Opt-in discoverability by exact name (roadmap #60): absent on every older
   * document, so it reads `false` and no band became findable by accident.
   */
  discoverable: boolean
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
  /**
   * What this member plays in **this** band (roadmap #88): ids from
   * `libs/bandRoles.ts` — instruments and jobs ("guitar", "lead vocal", the
   * sound desk). Band-scoped on purpose: the same account can be the drummer in
   * one band and the singer in another. Absent on every document written before
   * this shipped, so it reads `[]` and no migration exists.
   */
  instruments: string[]
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
  guest: "Guest",
}
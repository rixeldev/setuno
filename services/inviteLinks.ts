import { getFunctions, httpsCallable } from "@react-native-firebase/functions"

import type { InviteRole } from "@/functions/src/inviteLinks"

/** Input of the `createInviteLink` callable (functions/src/index.ts). */
export interface CreateInviteLinkInput {
  organizationId: string
  /** The role every person arriving through the link receives. */
  role: InviteRole
  /** `null` = never expires; otherwise one of `INVITE_LINK_EXPIRY_DAYS`. */
  expiresInDays: number | null
  /**
   * Mint a **new** token instead of handing back the band's current link. The
   * old URL dies in the same batch (anyone holding it can no longer join), and
   * the new link's `uses` counter starts at zero.
   */
  rotate?: boolean
}

export interface InviteLinkInfo {
  token: string
  /** Deadline in epoch milliseconds, `null` when the link never expires. */
  expiresAt: number | null
  role: InviteRole
  /** People who joined through this link so far. */
  uses: number
  /** True when the band's already-active link was refreshed in place. */
  reused: boolean
}

/** What the public join page shows before (and after) signing in. */
export interface InvitePreview {
  state: "ready" | "gone"
  organizationId: string
  organizationName: string
  role: InviteRole
  createdByName: string
  expiresAt: number | null
  uses: number
  /** Signed in and already in this band — the page offers the band instead. */
  alreadyMember: boolean
}

export interface RedeemedInvite {
  organizationId: string
  organizationName: string
  role: InviteRole
  /** The caller was already a member: nothing was written and no role changed. */
  alreadyMember: boolean
}

/**
 * Mint (or refresh) the band's invitation link. One callable round trip: the
 * server decides the token and the deadline, so two admins tapping at once
 * still end up sharing one URL.
 */
export const createInviteLink = async (input: CreateInviteLinkInput): Promise<InviteLinkInfo> => {
  const call = httpsCallable<CreateInviteLinkInput, InviteLinkInfo>(
    getFunctions(),
    "createInviteLink",
  )
  const response = await call(input)
  return response.data
}

/** Kill the link for good. Idempotent: revoking a missing token succeeds. */
export const revokeInviteLink = async (token: string): Promise<boolean> => {
  const call = httpsCallable<{ token: string }, { revoked: boolean }>(
    getFunctions(),
    "revokeInviteLink",
  )
  const response = await call({ token })
  return response.data.revoked
}

/**
 * The public page's read. Works signed out (the visitor has to see whose band
 * it is before deciding to sign in) and answers `state: "gone"` for a missing,
 * expired or orphaned link, so the page never renders a band that is no longer
 * there.
 */
export const previewInviteLink = async (token: string): Promise<InvitePreview> => {
  const call = httpsCallable<{ token: string }, InvitePreview>(getFunctions(), "previewInviteLink")
  const response = await call({ token })
  return response.data
}

/**
 * Join the band through the link: membership plus the caller's own band index,
 * written server-side in one transaction. Safe to call twice — somebody who is
 * already a member keeps the role they have.
 */
export const redeemInviteLink = async (token: string): Promise<RedeemedInvite> => {
  const call = httpsCallable<{ token: string }, RedeemedInvite>(getFunctions(), "redeemInviteLink")
  const response = await call({ token })
  return response.data
}

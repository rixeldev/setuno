/**
 * Invitation links (roadmap #89) — the pure core behind `createInviteLink`,
 * `revokeInviteLink`, `previewInviteLink` and `redeemInviteLink`.
 *
 * Zero firebase imports, not even type-only (the `shares.ts` / `notify.ts`
 * precedent): the app reads the role list, the expiry choices and every clamp
 * from this module through the `@/functions` alias, so Metro can never drag
 * firebase-admin into a bundle that imports it.
 *
 * Why a link instead of the ordinary email invitation: asking a new member for
 * their email is the tedious part of adding somebody to a band. A link is an
 * unguessable token the admin hands out (copy, share sheet or QR), it carries
 * the role it grants, it can be revoked, and it can expire on its own. The
 * document lives at `inviteLinks/{token}` and is **written only by the Admin
 * SDK** — no rule exists for it, so a phone can neither mint nor read one
 * directly: the four callables are the whole surface.
 *
 * A link is multi-use on purpose: band members hand it to a group chat and the
 * whole section joins with it, until the admin revokes it or its deadline
 * passes. One active link per band keeps "share again" idempotent — the same
 * URL comes back instead of a second one nobody can keep track of.
 */

/** The roles a link may grant. Same three the band itself uses. */
export const INVITE_LINK_ROLES = ["member", "admin", "guest"] as const

export type InviteRole = (typeof INVITE_LINK_ROLES)[number]

/**
 * Expiry choices, in the order the sheet offers them: a day first (a quick
 * "join us tonight"), then a week, a month, and the permanent link last — the
 * permanent one is the deliberate choice, not the accidental default.
 */
export const INVITE_LINK_EXPIRY_DAYS: readonly (number | null)[] = [1, 7, 30, null]

/**
 * What the callables use when the caller offers nothing: a week. Long enough
 * that the admin never has to think about it, short enough that a link left in
 * an old chat does not stay a key to the band forever.
 */
export const DEFAULT_INVITE_LINK_EXPIRY_DAYS = 7

/** Invite tokens are 16 random bytes as base64url — 22 chars, 128 bits. */
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{10,64}$/

/** Belt and braces on top of the batch: a link cannot be reused forever. */
export const INVITE_LINK_USES_MAX = 500

export const INVITE_NAME_MAX = 80
export const INVITE_EMAIL_MAX = 320
export const INVITE_BAND_NAME_MAX = 120

/** Shape check for a caller-supplied token before it touches a document path. */
export const isInviteToken = (value: unknown): value is string =>
  typeof value === "string" && INVITE_TOKEN_PATTERN.test(value)

export const isInviteRole = (value: unknown): value is InviteRole =>
  typeof value === "string" && (INVITE_LINK_ROLES as readonly string[]).includes(value)

/**
 * A stored or caller-supplied role, healed on read exactly like `normalizeRole`
 * does for members: an unrecognised value grants the least surprising thing —
 * a plain member — instead of failing an otherwise valid link.
 */
export const sanitizeInviteRole = (value: unknown): InviteRole =>
  isInviteRole(value) ? value : "member"

/**
 * The expiry the caller picked, validated against the offered choices.
 * `undefined` (absent) means "use the default"; `null` explicitly means never.
 * Anything else — including a number nobody offers — is `undefined`, which the
 * callable turns into an `invalid-argument` rather than silently coercing.
 */
export const readInviteExpiryChoice = (value: unknown): number | null | undefined => {
  if (value === undefined) return DEFAULT_INVITE_LINK_EXPIRY_DAYS
  if (value === null) return null
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  return INVITE_LINK_EXPIRY_DAYS.includes(value) ? Math.trunc(value) : undefined
}

/** Absolute expiry in epoch milliseconds, or `null` for a never-expiring link. */
export const inviteLinkExpiryAt = (days: number | null, nowMs: number): number | null =>
  days === null ? null : nowMs + days * 86_400_000

/** True when a link with this deadline is already dead (`null` never is). */
export const inviteLinkIsExpired = (expiresAtMs: number | null, nowMs: number): boolean => {
  if (expiresAtMs === null) return false
  // An unreadable deadline fails closed, exactly like the stored shape below.
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs
}

/**
 * The same question asked of a **stored** deadline, which arrives either as
 * `null` (never expires) or as a Firestore `Timestamp`. A deadline that cannot
 * be read fails **closed**: a corrupt field must never turn a link the admin
 * meant to expire into a permanent key to the band.
 */
export const inviteLinkIsDead = (expiresAt: unknown, nowMs: number): boolean => {
  if (expiresAt === null || expiresAt === undefined) return false
  if (typeof expiresAt === "number") return !Number.isFinite(expiresAt) || expiresAt <= nowMs
  const holder = expiresAt as { toMillis?: () => number }
  const millis = typeof holder.toMillis === "function" ? holder.toMillis() : Number.NaN
  return !Number.isFinite(millis) || millis <= nowMs
}

/** The one state the preview page and the redeem callable both branch on. */
export type InviteLinkState = "live" | "expired"

export const inviteLinkState = (expiresAtMs: number | null, nowMs: number): InviteLinkState =>
  inviteLinkIsExpired(expiresAtMs, nowMs) ? "expired" : "live"

/**
 * The name the new member's roster row carries. The Auth profile can be a
 * moment younger than the account (the #88 placeholder case), so a missing
 * name falls back to the email's local part instead of an empty row — and
 * never to a placeholder that would then need healing.
 */
export const inviteMemberName = (name: unknown, email: unknown): string => {
  const stated = typeof name === "string" ? name.trim() : ""
  if (stated.length > 0) return stated.slice(0, INVITE_NAME_MAX)
  const address = typeof email === "string" ? email.trim() : ""
  const local = address.includes("@") ? address.slice(0, address.indexOf("@")) : address
  return local.slice(0, INVITE_NAME_MAX)
}

/** The stored email, normalised like every other member document. */
export const inviteMemberEmail = (email: unknown): string =>
  typeof email === "string" ? email.trim().toLowerCase().slice(0, INVITE_EMAIL_MAX) : ""

/** The band's name as the preview and the mirror show it. */
export const inviteBandName = (name: unknown): string =>
  typeof name === "string" ? name.trim().slice(0, INVITE_BAND_NAME_MAX) : ""

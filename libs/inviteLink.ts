/**
 * Invitation link (roadmap #89). Pure — no React Native imports, so it unit
 * tests in node.
 *
 * The public shape is `<base>/join/<token>`: the web deploy serves it, a phone
 * opens it through App Links (`app-links.json` claims `/join`, and
 * `libs/deepLinks.ts` resolves the shape onto the app's own `/join/[token]`
 * route). The base address is the same one share links use — the live browser
 * origin, else `EXPO_PUBLIC_WEB_BASE_URL` — because a native build has no
 * origin of its own.
 */

import {
  INVITE_LINK_ROLES,
  type InviteRole,
} from "@/functions/src/inviteLinks"

/** Absolute URL of one invitation: `<base>/join/<token>`. */
export const buildInviteUrl = (baseUrl: string, token: string): string =>
  `${baseUrl.replace(/\/+$/, "")}/join/${encodeURIComponent(token)}`

/** The roles an invitation link may grant, in the order the sheet offers them. */
export const INVITE_ROLES: readonly InviteRole[] = INVITE_LINK_ROLES

/** What each role means, spelled on its chip (the same words the email dialog uses). */
export const INVITE_ROLE_LABEL_KEYS: Record<InviteRole, string> = {
  admin: "members.adminCanEdit",
  member: "members.memberCanSuggest",
  guest: "members.guestCanView",
}

/**
 * The translation key of one expiry choice. `null` is "no expiry"; the day
 * window has its own wording because "24 hours" reads better than "1 day" on
 * a link handed out for tonight.
 */
export const inviteExpiryKey = (days: number | null): string => {
  if (days === null) return "inviteLink.expiryNever"
  if (days === 1) return "inviteLink.expiry24h"
  return `inviteLink.expiry${days}d`
}

/**
 * The three answers a link can give after its deadline or its revocation, from
 * either callable: a missing document (`not-found`), an expired one
 * (`failed-precondition`) and a malformed token (`invalid-argument`). All three
 * mean the same thing to the page — "ask the band for a new link" — so they
 * collapse into one state instead of three error screens.
 *
 * Error codes differ by platform exactly like the share reads do (native
 * prefixes `functions/`), so the match is on the tail.
 */
export const isInviteLinkGone = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false
  const code = (error as { code?: unknown }).code
  if (typeof code !== "string") return false
  return (
    code.includes("not-found") ||
    code.includes("failed-precondition") ||
    code.includes("invalid-argument")
  )
}

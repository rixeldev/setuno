/**
 * The owner's complimentary Pro plan.
 *
 * Why it exists: the plan is **server-written only** (the rules have no
 * `allow write` for the entitlement), so testing anything behind the paywall
 * used to mean a real Play purchase. This module is the one exception — a
 * **closed allowlist** of account emails whose bands are granted Pro without a
 * purchase. Everybody else is untouched: `isOwnerEmail` is a string compare
 * that fails closed on an empty or missing value.
 *
 * Pure on purpose: no firebase imports, so the callable, the trigger and the
 * tests all read the same three functions (the `notify.ts`/`shares.ts`
 * precedent).
 *
 * Adding an email here is the only way to get the plan for free. The value is
 * not a secret (it is the owner's own account), but it must never become a
 * prefix/substring match: an allowlist entry is an exact, normalized address.
 */
import type { Entitlement } from "./entitlements"

/**
 * The accounts that carry Pro without paying.
 *
 * Keep it **exact addresses**, lowercased. Both are the owner's own Google
 * accounts: `rikirilis15@gmail.com` is the one the app signs in with (it owns
 * the bands), and `thewhitzip@gmail.com` is the repo's commit identity, kept so
 * a second device that signs in with it also sees the plan.
 */
export const OWNER_EMAILS: readonly string[] = [
  "rikirilis15@gmail.com",
  "thewhitzip@gmail.com",
]

/** Trims and lowercases whatever the token or a document carried. */
export const normalizeOwnerEmail = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : ""

/** True when the address is one of the owner's. Fails closed on anything else. */
export const isOwnerEmail = (value: unknown): boolean => {
  const email = normalizeOwnerEmail(value)
  return email.length > 0 && OWNER_EMAILS.includes(email)
}

/**
 * True when a caller's ID-token claims identify the owner.
 *
 * The email claim is signed by Firebase Auth, so it cannot be forged by the
 * client. `email_verified` is checked the permissive way on purpose: Google
 * and email-link accounts carry `true`, and only an account Firebase itself
 * marks as unverified is refused (an unverified address anybody could have
 * typed at sign-up).
 */
export const isOwnerCaller = (token: {
  email?: string
  email_verified?: boolean
} | null | undefined): boolean =>
  Boolean(token) && token?.email_verified !== false && isOwnerEmail(token?.email)

/**
 * The entitlement the owner's bands carry: no product, no expiry, and a
 * source of its own so the document says where the plan came from.
 */
export const ownerEntitlement = (now: string): Entitlement => ({
  plan: "pro",
  productId: "owner",
  source: "owner",
  expiresAt: null,
  updatedAt: now,
})

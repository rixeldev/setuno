import { describe, expect, it } from "vitest"

import {
  DEFAULT_INVITE_LINK_EXPIRY_DAYS,
  INVITE_LINK_EXPIRY_DAYS,
  INVITE_LINK_ROLES,
  INVITE_LINK_USES_MAX,
  inviteBandName,
  inviteLinkExpiryAt,
  inviteLinkIsDead,
  inviteLinkIsExpired,
  inviteLinkState,
  inviteMemberEmail,
  inviteMemberName,
  isInviteToken,
  readInviteExpiryChoice,
  readRotateFlag,
  sanitizeInviteRole,
} from "../../functions/src/inviteLinks"
import {
  buildInviteUrl,
  inviteExpiryKey,
  isInviteLinkGone,
} from "@/libs/inviteLink"
import { PENDING_JOIN_TTL_MS, pendingJoinFromJson, sanitizePendingJoin } from "@/libs/pendingJoin"

/**
 * Invitation links (roadmap #89): the pure contract the four callables and the
 * join page share — the roles and windows a link may carry, deadlines that
 * fail closed, and the token parked on the device between a tap and a sign-in.
 */

const NOW = 1_760_000_000_000

/** The shape of a Firestore `Timestamp` as the callables read it back. */
const stamp = (millis: number) => ({ toMillis: () => millis })

describe("invite link choices", () => {
  it("offers exactly the three roles the band has", () => {
    expect(INVITE_LINK_ROLES).toEqual(["member", "admin", "guest"])
  })

  it("offers the four agreed windows, permanent last", () => {
    expect(INVITE_LINK_EXPIRY_DAYS).toEqual([1, 7, 30, null])
    expect(DEFAULT_INVITE_LINK_EXPIRY_DAYS).toBe(7)
  })

  it("heals an unknown role into a plain member", () => {
    expect(sanitizeInviteRole("admin")).toBe("admin")
    expect(sanitizeInviteRole("guest")).toBe("guest")
    expect(sanitizeInviteRole("owner")).toBe("member")
    expect(sanitizeInviteRole(null)).toBe("member")
    expect(sanitizeInviteRole(7)).toBe("member")
  })

  it("reads an absent expiry as the default and null as never", () => {
    expect(readInviteExpiryChoice(undefined)).toBe(DEFAULT_INVITE_LINK_EXPIRY_DAYS)
    expect(readInviteExpiryChoice(null)).toBeNull()
    expect(readInviteExpiryChoice(1)).toBe(1)
    expect(readInviteExpiryChoice(30)).toBe(30)
  })

  it("rejects an expiry nobody offers instead of coercing it", () => {
    expect(readInviteExpiryChoice(2)).toBeUndefined()
    expect(readInviteExpiryChoice(0)).toBeUndefined()
    expect(readInviteExpiryChoice(-7)).toBeUndefined()
    expect(readInviteExpiryChoice("7")).toBeUndefined()
    expect(readInviteExpiryChoice(Number.NaN)).toBeUndefined()
  })
})

describe("rotating a link", () => {
  it("rotates only on a literal true", () => {
    expect(readRotateFlag(true)).toBe(true)
  })

  it("keeps the link in place for anything else", () => {
    // Creating is idempotent: a truthy stray must never destroy a URL the band
    // is already handing out.
    expect(readRotateFlag(undefined)).toBe(false)
    expect(readRotateFlag(null)).toBe(false)
    expect(readRotateFlag(false)).toBe(false)
    expect(readRotateFlag("true")).toBe(false)
    expect(readRotateFlag(1)).toBe(false)
    expect(readRotateFlag({ rotate: true })).toBe(false)
  })
})

describe("invite link deadlines", () => {
  it("adds the chosen window to the moment it was minted", () => {
    expect(inviteLinkExpiryAt(null, NOW)).toBeNull()
    expect(inviteLinkExpiryAt(1, NOW)).toBe(NOW + 86_400_000)
    expect(inviteLinkExpiryAt(7, NOW)).toBe(NOW + 7 * 86_400_000)
    expect(inviteLinkExpiryAt(30, NOW)).toBe(NOW + 30 * 86_400_000)
  })

  it("is dead at the deadline itself, not a millisecond later", () => {
    expect(inviteLinkIsExpired(null, NOW)).toBe(false)
    expect(inviteLinkIsExpired(NOW + 1, NOW)).toBe(false)
    expect(inviteLinkIsExpired(NOW, NOW)).toBe(true)
    expect(inviteLinkIsExpired(NOW - 1, NOW)).toBe(true)
    expect(inviteLinkState(NOW + 1, NOW)).toBe("live")
    expect(inviteLinkState(NOW - 1, NOW)).toBe("expired")
  })

  it("reads a stored deadline the same way", () => {
    expect(inviteLinkIsDead(null, NOW)).toBe(false)
    expect(inviteLinkIsDead(undefined, NOW)).toBe(false)
    expect(inviteLinkIsDead(stamp(NOW + 1), NOW)).toBe(false)
    expect(inviteLinkIsDead(stamp(NOW), NOW)).toBe(true)
    expect(inviteLinkIsDead(NOW + 1, NOW)).toBe(false)
    expect(inviteLinkIsDead(NOW - 1, NOW)).toBe(true)
  })

  it("fails closed on a deadline it cannot read", () => {
    // A corrupt field must never turn a link that was meant to expire into a
    // permanent key to the band.
    expect(inviteLinkIsDead("2026-10-25", NOW)).toBe(true)
    expect(inviteLinkIsDead({}, NOW)).toBe(true)
    expect(inviteLinkIsDead(Number.NaN, NOW)).toBe(true)
    expect(inviteLinkState(Number.NaN, NOW)).toBe("expired")
  })
})

describe("invite tokens", () => {
  it("accepts what the callable generates", () => {
    expect(isInviteToken("v1StGXR8Z5jdHi6BmyT8x")).toBe(true)
    expect(isInviteToken("abc-DEF_123-xyz_456-UV")).toBe(true)
  })

  it("rejects anything that could escape the document path", () => {
    expect(isInviteToken("../../etc/passwd")).toBe(false)
    expect(isInviteToken("a/b")).toBe(false)
    expect(isInviteToken("short")).toBe(false)
    expect(isInviteToken("")).toBe(false)
    expect(isInviteToken(null)).toBe(false)
    expect(isInviteToken(42)).toBe(false)
  })

  it("keeps a ceiling on how many people one link admits", () => {
    expect(INVITE_LINK_USES_MAX).toBeGreaterThan(0)
    expect(Number.isInteger(INVITE_LINK_USES_MAX)).toBe(true)
  })
})

describe("the member a redemption writes", () => {
  it("prefers the account's own name and clamps it", () => {
    expect(inviteMemberName("Ana Torres", "ana@example.com")).toBe("Ana Torres")
    expect(inviteMemberName("   Ana  ", "ana@example.com")).toBe("Ana")
    expect(inviteMemberName("x".repeat(200), "")).toHaveLength(80)
  })

  it("falls back to the email's local part when there is no name yet", () => {
    // The profile can be a moment younger than the account (a fresh sign-up
    // arriving straight through the link), so the row must still read well.
    expect(inviteMemberName(undefined, "ana.torres@example.com")).toBe("ana.torres")
    expect(inviteMemberName("", "ana@example.com")).toBe("ana")
    expect(inviteMemberName(null, "ana@example.com")).toBe("ana")
  })

  it("never invents a name when there is nothing at all", () => {
    expect(inviteMemberName(undefined, undefined)).toBe("")
    expect(inviteMemberName(null, null)).toBe("")
  })

  it("normalises the email like every other member document", () => {
    expect(inviteMemberEmail("  Ana@Example.COM ")).toBe("ana@example.com")
    expect(inviteMemberEmail(undefined)).toBe("")
    expect(inviteMemberEmail("x".repeat(400))).toHaveLength(320)
  })

  it("clamps the band name the preview shows", () => {
    expect(inviteBandName("  The Riverside Blues ")).toBe("The Riverside Blues")
    expect(inviteBandName("x".repeat(300))).toHaveLength(120)
    expect(inviteBandName(42)).toBe("")
  })
})

describe("buildInviteUrl", () => {
  it("builds the public join shape", () => {
    expect(buildInviteUrl("https://setuno.app", "abc123")).toBe(
      "https://setuno.app/join/abc123",
    )
  })

  it("tolerates trailing slashes on the base address", () => {
    expect(buildInviteUrl("https://setuno.vercel.app///", "abc")).toBe(
      "https://setuno.vercel.app/join/abc",
    )
  })

  it("escapes a token that would break the path", () => {
    expect(buildInviteUrl("https://setuno.app", "a/b?c")).toBe(
      "https://setuno.app/join/a%2Fb%3Fc",
    )
  })
})

describe("inviteExpiryKey", () => {
  it("names the same four windows the sheet offers", () => {
    expect(inviteExpiryKey(1)).toBe("inviteLink.expiry24h")
    expect(inviteExpiryKey(7)).toBe("inviteLink.expiry7d")
    expect(inviteExpiryKey(30)).toBe("inviteLink.expiry30d")
    expect(inviteExpiryKey(null)).toBe("inviteLink.expiryNever")
  })
})

describe("isInviteLinkGone", () => {
  it("collapses the three dead-link answers into one state", () => {
    expect(isInviteLinkGone({ code: "functions/not-found" })).toBe(true)
    expect(isInviteLinkGone({ code: "functions/failed-precondition" })).toBe(true)
    expect(isInviteLinkGone({ code: "functions/invalid-argument" })).toBe(true)
    expect(isInviteLinkGone({ code: "not-found" })).toBe(true)
  })

  it("lets a real failure through", () => {
    expect(isInviteLinkGone({ code: "functions/unavailable" })).toBe(false)
    expect(isInviteLinkGone(new Error("offline"))).toBe(false)
    expect(isInviteLinkGone(null)).toBe(false)
    expect(isInviteLinkGone(undefined)).toBe(false)
  })
})

describe("the pending invitation link", () => {
  const token = "v1StGXR8Z5jdHi6BmyT8x"

  it("keeps a fresh entry", () => {
    expect(sanitizePendingJoin({ token, savedAt: NOW }, NOW)).toEqual({ token, savedAt: NOW })
  })

  it("drops a malformed entry", () => {
    expect(sanitizePendingJoin(null, NOW)).toBeNull()
    expect(sanitizePendingJoin("token", NOW)).toBeNull()
    expect(sanitizePendingJoin([token], NOW)).toBeNull()
    expect(sanitizePendingJoin({ token: "a/b", savedAt: NOW }, NOW)).toBeNull()
    expect(sanitizePendingJoin({ token, savedAt: "now" }, NOW)).toBeNull()
    expect(sanitizePendingJoin({ token }, NOW)).toBeNull()
  })

  it("expires after the window", () => {
    const fresh = NOW - PENDING_JOIN_TTL_MS + 1
    expect(sanitizePendingJoin({ token, savedAt: fresh }, NOW)).not.toBeNull()
    expect(sanitizePendingJoin({ token, savedAt: NOW - PENDING_JOIN_TTL_MS - 1 }, NOW)).toBeNull()
  })

  it("does not trust a stamp from the future", () => {
    expect(sanitizePendingJoin({ token, savedAt: NOW + 7 * 86_400_000 }, NOW)).toBeNull()
    expect(sanitizePendingJoin({ token, savedAt: 0 }, NOW)).toBeNull()
  })

  it("recovers from the raw storage string", () => {
    expect(pendingJoinFromJson(JSON.stringify({ token, savedAt: NOW }), NOW)).toEqual({
      token,
      savedAt: NOW,
    })
    expect(pendingJoinFromJson(null, NOW)).toBeNull()
    expect(pendingJoinFromJson("not json", NOW)).toBeNull()
    expect(pendingJoinFromJson('"token"', NOW)).toBeNull()
  })
})

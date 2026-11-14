import { describe, expect, it } from "vitest"

import { isPro, mapEntitlement } from "@/functions/src/entitlements"
import {
  OWNER_EMAILS,
  isOwnerCaller,
  isOwnerEmail,
  normalizeOwnerEmail,
  ownerEntitlement,
} from "@/functions/src/ownerPlan"

/**
 * The owner's complimentary plan: the one path to Pro that does not go through
 * a store, so the tests are all about **failing closed** — anything that is not
 * exactly one of the allowlisted addresses must grant nothing.
 */

const OWNER = OWNER_EMAILS[0]

describe("the owner plan allowlist", () => {
  it("matches an allowlisted address regardless of case and spaces", () => {
    expect(isOwnerEmail(OWNER)).toBe(true)
    expect(isOwnerEmail(`  ${OWNER.toUpperCase()}  `)).toBe(true)
  })

  it("never matches a prefix, a suffix or a look-alike domain", () => {
    expect(isOwnerEmail(`x${OWNER}`)).toBe(false)
    expect(isOwnerEmail(`${OWNER}.evil.com`)).toBe(false)
    expect(isOwnerEmail(OWNER.replace(".com", ".co"))).toBe(false)
  })

  it("fails closed on anything that is not a string", () => {
    expect(isOwnerEmail(undefined)).toBe(false)
    expect(isOwnerEmail(null)).toBe(false)
    expect(isOwnerEmail(42)).toBe(false)
    expect(isOwnerEmail("")).toBe(false)
    expect(normalizeOwnerEmail(undefined)).toBe("")
  })
})

describe("the owner's caller claims", () => {
  it("accepts the owner's verified token", () => {
    expect(isOwnerCaller({ email: OWNER, email_verified: true })).toBe(true)
  })

  it("accepts a token that does not carry the flag at all", () => {
    // Only an explicit `false` is refused: providers that omit the claim are
    // not lying about it.
    expect(isOwnerCaller({ email: OWNER })).toBe(true)
  })

  it("refuses an unverified address, which anybody could have typed", () => {
    expect(isOwnerCaller({ email: OWNER, email_verified: false })).toBe(false)
  })

  it("refuses a missing token or a missing email", () => {
    expect(isOwnerCaller(null)).toBe(false)
    expect(isOwnerCaller(undefined)).toBe(false)
    expect(isOwnerCaller({})).toBe(false)
  })
})

describe("the owner's entitlement", () => {
  it("is Pro, never expires and names its source", () => {
    const entitlement = ownerEntitlement("2026-11-14")
    expect(entitlement.plan).toBe("pro")
    expect(entitlement.source).toBe("owner")
    expect(entitlement.productId).toBe("owner")
    expect(entitlement.expiresAt).toBeNull()
    expect(entitlement.updatedAt).toBe("2026-11-14")
    expect(isPro(entitlement)).toBe(true)
  })

  it("survives the mapper with its source", () => {
    const stored = mapEntitlement(ownerEntitlement("2026-11-14"), "2026-11-15")
    expect(stored.plan).toBe("pro")
    expect(stored.source).toBe("owner")
    expect(isPro(stored)).toBe(true)
  })
})

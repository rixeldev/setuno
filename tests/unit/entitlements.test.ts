import { describe, expect, it } from "vitest"

import {
  FREE_LIMITS,
  PRO_PRODUCTS,
  freeEntitlement,
  isKnownProduct,
  isPro,
  mapEntitlement,
} from "@/functions/src/entitlements"

/**
 * The Pro plan (roadmap #61): the entitlement is written by the server, so
 * the pure part is about **healing** — a document nobody can read must never
 * grant anything, and a broken one must not take the plan away from a member
 * who paid.
 */

const NOW = "2026-10-20"

describe("the entitlement", () => {
  it("is the free plan before anything is bought", () => {
    expect(isPro(freeEntitlement(NOW))).toBe(false)
    expect(freeEntitlement(NOW).plan).toBe("free")
  })

  it("grants Pro while the period lasts", () => {
    expect(isPro({ ...freeEntitlement(NOW), plan: "pro", expiresAt: "2099-01-01" })).toBe(true)
  })

  it("grants Pro without an end date", () => {
    expect(isPro({ ...freeEntitlement(NOW), plan: "pro", expiresAt: null })).toBe(true)
  })

  it("drops Pro once the period is over", () => {
    expect(isPro({ ...freeEntitlement(NOW), plan: "pro", expiresAt: "2020-01-01" })).toBe(false)
  })

  it("grants nothing to a missing entitlement", () => {
    expect(isPro(null)).toBe(false)
    expect(isPro(undefined)).toBe(false)
  })
})

describe("mapEntitlement", () => {
  it("reads a healthy document", () => {
    const entitlement = mapEntitlement(
      {
        plan: "pro",
        productId: PRO_PRODUCTS.monthly,
        source: "play",
        expiresAt: "2027-01-01",
        updatedAt: "2026-10-01",
      },
      NOW,
    )
    expect(entitlement.plan).toBe("pro")
    expect(entitlement.productId).toBe(PRO_PRODUCTS.monthly)
    expect(entitlement.expiresAt).toBe("2027-01-01")
  })

  it("heals a missing document into the free plan", () => {
    expect(mapEntitlement(null, NOW).plan).toBe("free")
    expect(mapEntitlement(undefined, NOW).plan).toBe("free")
  })

  it("never grants Pro to a document it does not understand", () => {
    expect(mapEntitlement({ plan: "enterprise" }, NOW).plan).toBe("free")
    expect(mapEntitlement({ plan: 42 }, NOW).plan).toBe("free")
  })

  it("drops a broken expiry instead of trusting it", () => {
    expect(mapEntitlement({ plan: "pro", expiresAt: "soon" }, NOW).expiresAt).toBeNull()
  })

  it("keeps the expiry's day and drops the time", () => {
    expect(mapEntitlement({ plan: "pro", expiresAt: "2027-01-01T10:00:00Z" }, NOW).expiresAt).toBe(
      "2027-01-01",
    )
  })
})

describe("the products", () => {
  it("knows the plan products and the tip", () => {
    expect(isKnownProduct(PRO_PRODUCTS.monthly)).toBe(true)
    expect(isKnownProduct(PRO_PRODUCTS.annual)).toBe(true)
    expect(isKnownProduct(PRO_PRODUCTS.tip)).toBe(true)
    expect(isKnownProduct("setuno_pro_forever")).toBe(false)
  })
})

describe("the free limits", () => {
  it("holds one band and a base songbook", () => {
    expect(FREE_LIMITS.bands).toBe(1)
    expect(FREE_LIMITS.songs).toBeGreaterThan(0)
  })
})

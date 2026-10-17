import { describe, expect, it } from "vitest"

import type { OrganizationRole } from "@/interfaces"
import {
  ORGANIZATION_ROLES,
  canCollaborate,
  canEditBand,
  normalizeRole,
} from "@/libs/membership"

describe("ORGANIZATION_ROLES", () => {
  it("lists every role the roster can carry", () => {
    expect([...ORGANIZATION_ROLES]).toEqual(["admin", "member", "guest"])
  })
})

describe("normalizeRole", () => {
  it("keeps the three real roles", () => {
    expect(normalizeRole("admin")).toBe("admin")
    expect(normalizeRole("member")).toBe("member")
    expect(normalizeRole("guest")).toBe("guest")
  })

  it("self-heals anything unrecognised back to member", () => {
    // Stored roles come from untrusted documents: a stray value must read as
    // a plain member (the normalizeSongStatus precedent), never as an admin.
    expect(normalizeRole(undefined)).toBe("member")
    expect(normalizeRole(null)).toBe("member")
    expect(normalizeRole("wizard")).toBe("member")
    expect(normalizeRole("Admin")).toBe("member")
    expect(normalizeRole(3)).toBe("member")
  })
})

describe("canEditBand", () => {
  it("is admin-only", () => {
    expect(canEditBand("admin")).toBe(true)
    expect(canEditBand("member")).toBe(false)
    expect(canEditBand("guest")).toBe(false)
    expect(canEditBand(null)).toBe(false)
  })
})

describe("canCollaborate", () => {
  it("admits the band, never a guest", () => {
    // The UI half of the rules line: suggestions, comments, polls, the event
    // logistics and the live pointer are all denied to guests server-side,
    // so their doors are withheld here instead of failing on write.
    const matrix: [OrganizationRole | null, boolean][] = [
      ["admin", true],
      ["member", true],
      ["guest", false],
      [null, false],
    ]
    for (const [role, expected] of matrix) {
      expect(canCollaborate(role), role ?? "null").toBe(expected)
    }
  })
})

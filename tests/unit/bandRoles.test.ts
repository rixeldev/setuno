import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import type { OrganizationMember } from "@/interfaces"
import {
  BAND_ROLES,
  MAX_MEMBER_ROLES,
  MAX_SONG_LINEUP,
  bandRoleLabel,
  cleanLineup,
  isBandRole,
  lineupSummary,
  memberRolesLabel,
  resolveLineup,
  roleLabels,
  rolesForMember,
  sanitizeRoleIds,
} from "@/libs/bandRoles"

const member = (uid: string, displayName: string, instruments: string[] = []): OrganizationMember =>
  ({
    uid,
    displayName,
    email: `${uid}@band.test`,
    photoURL: null,
    role: "member",
    instruments,
  }) as unknown as OrganizationMember

/** Stands in for i18next: resolves the key, or echoes the interpolation. */
const t = (key: string, options?: Record<string, unknown>): string => {
  if (key === "setlists.lineupPair" && options) {
    return `${String(options.role)}: ${String(options.name)}`
  }
  return key
}

describe("the catalogue", () => {
  it("has unique ids and one label key each", () => {
    const ids = BAND_ROLES.map((role) => role.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const role of BAND_ROLES) {
      expect(role.labelKey).toBe(`bandRoles.${role.id}`)
    }
  })

  it("is translated in every shipped language", () => {
    // The label is resolved through a template literal, so `i18n.test.ts`'s
    // static-key check cannot see it. A missing translation would print the raw
    // key to the band, so the four bundles are checked here instead.
    for (const bundle of ["en.json", "es.json", "pt-BR.json", "fr.json"]) {
      const contents = JSON.parse(
        readFileSync(join(process.cwd(), "locales", bundle), "utf8"),
      ) as Record<string, Record<string, string>>
      for (const role of BAND_ROLES) {
        const label = contents.bandRoles?.[role.id]
        expect(label, `${bundle} is missing ${role.id}`).toBeTypeOf("string")
        expect(label?.trim().length, `${bundle} has a blank ${role.id}`).toBeGreaterThan(0)
      }
    }
  })

  it("recognises only real roles", () => {
    expect(isBandRole("guitar")).toBe(true)
    expect(isBandRole("Guitar")).toBe(false)
    expect(isBandRole("triangle")).toBe(false)
    expect(isBandRole(undefined)).toBe(false)
  })

  it("names a role through its key and stays quiet about the rest", () => {
    expect(bandRoleLabel("bass", t)).toBe("bandRoles.bass")
    expect(bandRoleLabel("triangle", t)).toBe("")
  })
})

describe("sanitizeRoleIds", () => {
  it("heals a stored list", () => {
    expect(sanitizeRoleIds(["bass", "bass", "triangle", 3, null])).toEqual(["bass"])
    expect(sanitizeRoleIds(undefined)).toEqual([])
    expect(sanitizeRoleIds("guitar")).toEqual([])
  })

  it("reads back in catalogue order, not the order it was written in", () => {
    expect(sanitizeRoleIds(["drums", "leadVocal", "guitar"])).toEqual([
      "leadVocal",
      "guitar",
      "drums",
    ])
  })

  it("caps what one member may declare", () => {
    const tooMany = BAND_ROLES.map((role) => role.id)
    expect(tooMany.length).toBeGreaterThan(MAX_MEMBER_ROLES)
    expect(sanitizeRoleIds(tooMany)).toHaveLength(MAX_MEMBER_ROLES)
  })
})

describe("roleLabels / memberRolesLabel", () => {
  it("drops the roles it cannot name", () => {
    expect(roleLabels(["guitar", "triangle"], t)).toEqual(["bandRoles.guitar"])
  })

  it("joins a member's roles in one line", () => {
    expect(memberRolesLabel(member("a", "Julia", ["guitar", "backingVocal"]), t)).toBe(
      "bandRoles.backingVocal · bandRoles.guitar",
    )
  })

  it("says nothing for a member with no roles", () => {
    expect(memberRolesLabel(member("a", "Julia"), t)).toBe("")
  })
})

describe("cleanLineup", () => {
  it("heals a stored line-up", () => {
    expect(
      cleanLineup({ a: "leadVocal", b: "triangle", "": "guitar", c: 7, d: "drums" }),
    ).toEqual({ a: "leadVocal", d: "drums" })
  })

  it("takes anything that is not an object as no line-up", () => {
    expect(cleanLineup(undefined)).toEqual({})
    expect(cleanLineup(["a"])).toEqual({})
    expect(cleanLineup("a")).toEqual({})
  })

  it("caps the members one song may name", () => {
    const wide: Record<string, string> = {}
    for (let index = 0; index < MAX_SONG_LINEUP + 20; index++) {
      wide[`uid-${index}`] = "guitar"
    }
    expect(Object.keys(cleanLineup(wide))).toHaveLength(MAX_SONG_LINEUP)
  })
})

describe("resolveLineup", () => {
  const roster = [
    member("zoe", "Zoe"),
    member("ana", "Ana"),
    member("manu", "Manuel"),
  ]

  it("orders by role and then by name", () => {
    const entries = resolveLineup({ zoe: "drums", ana: "leadVocal", manu: "guitar" }, roster)
    expect(entries.map((entry) => entry.uid)).toEqual(["ana", "manu", "zoe"])
  })

  it("keeps two members on the same role, by name", () => {
    const entries = resolveLineup({ zoe: "guitar", manu: "guitar" }, roster)
    expect(entries.map((entry) => entry.name)).toEqual(["Manuel", "Zoe"])
  })

  it("drops a member who left the band", () => {
    const entries = resolveLineup({ gone: "guitar", ana: "leadVocal" }, roster)
    expect(entries.map((entry) => entry.uid)).toEqual(["ana"])
  })

  it("falls back to the email when a member has no name", () => {
    const entries = resolveLineup({ x: "bass" }, [member("x", "  ")])
    expect(entries[0]?.name).toBe("x@band.test")
  })

  it("carries the role the song was given", () => {
    const entries = resolveLineup({ manu: "guitar" }, roster)
    expect(entries[0]).toMatchObject({ uid: "manu", name: "Manuel", role: "guitar" })
  })
})

describe("lineupSummary", () => {
  const roster = [member("ana", "Julia"), member("manu", "Manuel")]

  it("pairs every role with its name", () => {
    const entries = resolveLineup({ manu: "guitar", ana: "leadVocal" }, roster)
    expect(lineupSummary(entries, t)).toBe(
      "bandRoles.leadVocal: Julia · bandRoles.guitar: Manuel",
    )
  })

  it("is empty when nobody plays, or when the roles cannot be named", () => {
    expect(lineupSummary([], t)).toBe("")
    expect(lineupSummary(resolveLineup({ ana: "triangle" }, roster), t)).toBe("")
  })
})

describe("rolesForMember", () => {
  it("offers the member's own roles first and then the rest", () => {
    const offered = rolesForMember(member("a", "Julia", ["drums", "guitar"]))
    expect(offered.slice(0, 2)).toEqual(["guitar", "drums"])
    expect(offered).toHaveLength(BAND_ROLES.length)
    expect(new Set(offered).size).toBe(BAND_ROLES.length)
  })

  it("offers the whole catalogue to a member who declared nothing", () => {
    expect(rolesForMember(null)).toEqual(BAND_ROLES.map((role) => role.id))
  })
})

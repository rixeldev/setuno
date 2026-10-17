/**
 * The account-deletion planner (roadmap #68) as a pure function: what one
 * member's exit does to each band they belong to. The Firestore half of the
 * feature runs against the emulator in `tests/integration/accountData.test.ts`
 * (the `trashPurge.test.ts` split); every *decision* lives here.
 */
import { describe, expect, it } from "vitest"

import {
  ACCOUNT_EXPORT_BYTES_MAX,
  accountExportFileName,
  planOrgRemovals,
  type OrgRoster,
  type RosterMember,
} from "../../functions/src/accountData"

const member = (
  uid: string,
  role: "admin" | "member" | "guest",
  joinedAt: number | null,
): RosterMember => ({
  uid,
  role,
  joinedAt,
})

const MINUTE = 60_000

describe("accountExportFileName", () => {
  it("names the file by day, carrying no user data", () => {
    expect(accountExportFileName(new Date(Date.UTC(2026, 9, 17)))).toBe(
      "setuno-account-export-2026-10-17.json",
    )
  })
})

describe("ACCOUNT_EXPORT_BYTES_MAX", () => {
  it("stays under the callable response cap of 10 MB", () => {
    expect(ACCOUNT_EXPORT_BYTES_MAX).toBeLessThan(10_000_000)
  })
})

describe("planOrgRemovals", () => {
  it("deletes a band that had nobody else in it, whole", () => {
    const org: OrgRoster = {
      orgId: "solo-band",
      ownerId: "u1",
      members: [member("u1", "admin", MINUTE)],
    }
    expect(planOrgRemovals([org], "u1")).toEqual([{ orgId: "solo-band", action: "cascade" }])
  })

  it("leaves a band that keeps its people, with nothing to promote", () => {
    const org: OrgRoster = {
      orgId: "band",
      ownerId: "u0",
      members: [
        member("u0", "admin", 0),
        member("u1", "member", MINUTE),
        member("u2", "member", 2 * MINUTE),
      ],
    }
    expect(planOrgRemovals([org], "u1")).toEqual([
      { orgId: "band", action: "leave", promoteUid: null, transferOwnerTo: null },
    ])
  })

  it("promotes the most senior member when the last admin leaves", () => {
    const org: OrgRoster = {
      orgId: "band",
      ownerId: "u1",
      members: [
        member("u1", "admin", 0),
        member("u2", "member", 3 * MINUTE),
        member("u3", "member", MINUTE),
      ],
    }
    expect(planOrgRemovals([org], "u1")).toEqual([
      { orgId: "band", action: "leave", promoteUid: "u3", transferOwnerTo: "u3" },
    ])
  })

  it("skips a more senior guest when the last admin leaves (roadmap #59)", () => {
    // A guest is read-only: promoting one would leave the band without
    // anybody who can invite, edit or manage members.
    const org: OrgRoster = {
      orgId: "band",
      ownerId: "u1",
      members: [
        member("u1", "admin", 0),
        member("u2", "guest", MINUTE),
        member("u3", "member", 2 * MINUTE),
      ],
    }
    expect(planOrgRemovals([org], "u1")).toEqual([
      { orgId: "band", action: "leave", promoteUid: "u3", transferOwnerTo: "u3" },
    ])
  })

  it("promotes nobody when the band is guests-only, but still hands the owner keys over", () => {
    // No candidate can administer, so no promotion happens — yet the owner
    // keys must move anyway: a dangling ownerId would leave the band
    // undeletable forever, so the senior guest takes that last baton.
    const org: OrgRoster = {
      orgId: "band",
      ownerId: "u1",
      members: [member("u1", "admin", 0), member("u2", "guest", MINUTE)],
    }
    expect(planOrgRemovals([org], "u1")).toEqual([
      { orgId: "band", action: "leave", promoteUid: null, transferOwnerTo: "u2" },
    ])
  })

  it("breaks a seniority tie by uid, so every server agrees", () => {
    const org: OrgRoster = {
      orgId: "band",
      ownerId: "u1",
      members: [
        member("u1", "admin", 0),
        member("u2", "member", MINUTE),
        member("u3", "member", MINUTE),
      ],
    }
    expect(planOrgRemovals([org], "u1")).toEqual([
      { orgId: "band", action: "leave", promoteUid: "u2", transferOwnerTo: "u2" },
    ])
  })

  it("ranks an unknown joinedAt last, behind every dated member", () => {
    const org: OrgRoster = {
      orgId: "band",
      ownerId: "u1",
      members: [
        member("u1", "admin", 0),
        member("u2", "member", null),
        member("u3", "member", MINUTE),
      ],
    }
    expect(planOrgRemovals([org], "u1")).toEqual([
      { orgId: "band", action: "leave", promoteUid: "u3", transferOwnerTo: "u3" },
    ])
  })

  it("falls back to the uid when no member has a date at all", () => {
    const org: OrgRoster = {
      orgId: "band",
      ownerId: "u1",
      members: [member("u1", "admin", 0), member("u3", "member", null), member("u2", "member", null)],
    }
    expect(planOrgRemovals([org], "u1")).toEqual([
      { orgId: "band", action: "leave", promoteUid: "u2", transferOwnerTo: "u2" },
    ])
  })

  it("promotes nobody while an admin stays behind", () => {
    const org: OrgRoster = {
      orgId: "band",
      ownerId: "u1",
      members: [member("u1", "admin", 0), member("u2", "admin", MINUTE), member("u3", "member", 2 * MINUTE)],
    }
    expect(planOrgRemovals([org], "u1")).toEqual([
      { orgId: "band", action: "leave", promoteUid: null, transferOwnerTo: "u2" },
    ])
  })

  it("hands the owner keys to the earliest admin when no promotion is needed", () => {
    const org: OrgRoster = {
      orgId: "band",
      ownerId: "u1",
      members: [member("u1", "admin", 0), member("u3", "member", MINUTE), member("u2", "admin", 2 * MINUTE)],
    }
    expect(planOrgRemovals([org], "u1")).toEqual([
      { orgId: "band", action: "leave", promoteUid: null, transferOwnerTo: "u2" },
    ])
  })

  it("keeps another band's plan untouched in the same run", () => {
    const roster: OrgRoster[] = [
      { orgId: "solo-band", ownerId: "u1", members: [member("u1", "admin", 0)] },
      { orgId: "band", ownerId: "u0", members: [member("u0", "admin", 0), member("u1", "member", MINUTE)] },
    ]
    expect(planOrgRemovals(roster, "u1")).toEqual([
      { orgId: "solo-band", action: "cascade" },
      { orgId: "band", action: "leave", promoteUid: null, transferOwnerTo: null },
    ])
  })

  it("hands the keys over even when the leaver is already gone (a retry)", () => {
    // A first run that died between deleting the membership and handing over
    // `ownerId` leaves exactly this roster: no leaver, an owner uid that no
    // longer resolves to a member.
    const org: OrgRoster = {
      orgId: "band",
      ownerId: "u1",
      members: [member("u2", "member", MINUTE)],
    }
    expect(planOrgRemovals([org], "u1")).toEqual([
      { orgId: "band", action: "leave", promoteUid: null, transferOwnerTo: "u2" },
    ])
  })
})

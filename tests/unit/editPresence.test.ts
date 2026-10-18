import { describe, expect, it } from "vitest"

import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_TTL_MS,
  isPresenceFresh,
  liveEditors,
  mapPresence,
  presenceName,
} from "@/libs/editPresence"
import type { SongPresence } from "@/interfaces"

const editor = (uid: string, displayName = uid, updatedAt = new Date(1_000)): SongPresence => ({
  uid,
  displayName,
  updatedAt,
})

describe("the freshness window", () => {
  it("outlives two missed heartbeats before a dot goes dark", () => {
    expect(PRESENCE_TTL_MS).toBeGreaterThanOrEqual(PRESENCE_HEARTBEAT_MS * 2)
    expect(PRESENCE_TTL_MS).toBeLessThan(PRESENCE_HEARTBEAT_MS * 4)
  })

  it("keeps a dot at the exact edge of the window", () => {
    const at = editor("ann", "Ann", new Date(0))
    expect(isPresenceFresh(at, PRESENCE_TTL_MS)).toBe(true)
    expect(isPresenceFresh(at, PRESENCE_TTL_MS + 1)).toBe(false)
  })

  it("trusts a heartbeat from the future (clock skew never hides a live editor)", () => {
    expect(isPresenceFresh(editor("ann", "Ann", new Date(60_000)), 0)).toBe(true)
  })
})

describe("presenceName", () => {
  it("trims the ends and collapses internal whitespace", () => {
    expect(presenceName("  Ann   Lee  ")).toBe("Ann Lee")
  })

  it("clamps to the size the rules pin", () => {
    expect(presenceName(` ${"x".repeat(120)} `)).toHaveLength(80)
  })

  it("refuses empty or non-string values", () => {
    expect(presenceName("   ")).toBeNull()
    expect(presenceName(42)).toBeNull()
    expect(presenceName(null)).toBeNull()
  })
})

describe("mapPresence", () => {
  it("maps a well-formed dot, whatever clock it carries", () => {
    const date = new Date(5_000)
    expect(mapPresence("ann", { uid: "ann", displayName: " Ann ", updatedAt: date })).toEqual({
      uid: "ann",
      displayName: "Ann",
      updatedAt: date,
    })
    const timestamp = { toDate: () => date }
    expect(mapPresence("ann", { uid: "ann", displayName: "Ann", updatedAt: timestamp })).toEqual({
      uid: "ann",
      displayName: "Ann",
      updatedAt: date,
    })
  })

  it("heals a dot whose id and uid disagree", () => {
    expect(mapPresence("ann", { uid: "bob", displayName: "Ann", updatedAt: new Date() })).toBeNull()
  })

  it("heals a dot without a usable name or stamp", () => {
    expect(mapPresence("ann", { uid: "ann", displayName: "  ", updatedAt: new Date() })).toBeNull()
    expect(mapPresence("ann", { uid: "ann", displayName: "Ann" })).toBeNull()
    expect(
      mapPresence("ann", { uid: "ann", displayName: "Ann", updatedAt: "yesterday" }),
    ).toBeNull()
  })
})

describe("liveEditors", () => {
  const now = 100_000
  const fresh = (uid: string, displayName: string) =>
    editor(uid, displayName, new Date(now - 1_000))
  const stale = (uid: string, displayName: string) =>
    editor(uid, displayName, new Date(now - PRESENCE_TTL_MS - 1))

  it("drops the caller and every dot outside the window", () => {
    const docs = [fresh("ann", "Ann"), fresh("bob", "Bob"), stale("cid", "Cid")]
    expect(liveEditors(docs, "ann", now).map((entry) => entry.uid)).toEqual(["bob"])
    expect(liveEditors(docs, null, now).map((entry) => entry.uid)).toEqual(["ann", "bob"])
  })

  it("sorts by name so the line cannot shuffle, falling back to uid", () => {
    const docs = [fresh("b-uid", "bob"), fresh("a-uid", "Ámbar"), fresh("z-uid", "Bob")]
    expect(liveEditors(docs, null, now).map((entry) => entry.uid)).toEqual([
      "a-uid",
      "b-uid",
      "z-uid",
    ])
  })

  it("never mutates the input list", () => {
    const docs = [fresh("bob", "Bob"), fresh("ann", "Ann")]
    liveEditors(docs, null, now)
    expect(docs.map((entry) => entry.uid)).toEqual(["bob", "ann"])
  })
})

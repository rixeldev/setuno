import { describe, expect, it } from "vitest"

import type { Song, SongStatus } from "@/interfaces"
import {
  DEFAULT_SONG_STATUS,
  SONG_STATUSES,
  isPickableForSetlist,
  isSongStatus,
  normalizeSongStatus,
} from "@/libs/songStatus"

const songWith = (status: unknown): Song => ({ status } as unknown as Song)

describe("normalizeSongStatus", () => {
  it("keeps every documented status", () => {
    for (const status of SONG_STATUSES) {
      expect(normalizeSongStatus(status)).toBe(status)
    }
  })

  it("falls back to active for anything unrecognised", () => {
    expect(normalizeSongStatus("archived")).toBe("active")
    expect(normalizeSongStatus(undefined)).toBe("active")
    expect(normalizeSongStatus(null)).toBe("active")
    expect(normalizeSongStatus(3)).toBe("active")
    expect(DEFAULT_SONG_STATUS).toBe("active")
  })

  it("guards the type for stored data", () => {
    expect(isSongStatus("draft")).toBe(true)
    expect(isSongStatus("retired")).toBe(true)
    expect(isSongStatus("active ")).toBe(false)
    expect(isSongStatus("")).toBe(false)
  })
})

describe("isPickableForSetlist", () => {
  const cases: [SongStatus, boolean][] = [
    ["draft", true],
    ["active", true],
    ["retired", false],
  ]

  it.each(cases)("a %s song is %s pickable by default", (status, expected) => {
    expect(isPickableForSetlist(songWith(status))).toBe(expected)
  })

  it("includes retired songs only when the picker says so", () => {
    expect(isPickableForSetlist(songWith("retired"), true)).toBe(true)
    expect(isPickableForSetlist(songWith("active"), false)).toBe(true)
  })
})

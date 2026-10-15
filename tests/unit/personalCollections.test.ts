import { describe, expect, it } from "vitest"

import {
  MAX_COLLECTION_NAME,
  MAX_COLLECTION_SONGS,
  collectionName,
  sanitizeSongIds,
} from "@/libs/personalCollections"

describe("sanitizeSongIds", () => {
  it("keeps strings in order, dropping blanks and duplicates", () => {
    expect(sanitizeSongIds(["a", 1, "b", "", "a", null, "c"])).toEqual(["a", "b", "c"])
  })

  it("returns an empty list for anything that is not an array", () => {
    expect(sanitizeSongIds(undefined)).toEqual([])
    expect(sanitizeSongIds("a")).toEqual([])
    expect(sanitizeSongIds({ ids: ["a"] })).toEqual([])
    expect(sanitizeSongIds(null)).toEqual([])
  })

  it("caps the list at the limit", () => {
    const raw = Array.from({ length: MAX_COLLECTION_SONGS + 50 }, (_, index) => `s${index}`)
    expect(sanitizeSongIds(raw)).toHaveLength(MAX_COLLECTION_SONGS)
    expect(sanitizeSongIds(raw, 3)).toEqual(["s0", "s1", "s2"])
  })
})

describe("collectionName", () => {
  it("trims and bounds a real name", () => {
    expect(collectionName("  Sunday gig  ")).toBe("Sunday gig")
    expect(collectionName("x".repeat(MAX_COLLECTION_NAME + 20))).toHaveLength(MAX_COLLECTION_NAME)
  })

  it("rejects empty and non-string names", () => {
    expect(collectionName("   ")).toBeNull()
    expect(collectionName("")).toBeNull()
    expect(collectionName(42)).toBeNull()
    expect(collectionName(null)).toBeNull()
  })
})

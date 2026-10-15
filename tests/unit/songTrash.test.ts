import { describe, expect, it } from "vitest"

import type { Song } from "@/interfaces"
import type { TimestampLike } from "@/interfaces/timestamp"
import { isTrashed, partitionTrashed } from "@/libs/songTrash"

const STAMP: TimestampLike = { seconds: 1, nanoseconds: 0, toDate: () => new Date(1000) }

const song = (id: string, deletedAt: TimestampLike | null = null): Song =>
  ({ id, deletedAt } as unknown as Song)

describe("isTrashed", () => {
  it("treats an absent or null timestamp as live", () => {
    expect(isTrashed({ id: "a" } as unknown as Song)).toBe(false)
    expect(isTrashed(song("b"))).toBe(false)
    expect(isTrashed(song("c", null))).toBe(false)
  })

  it("treats a deletion timestamp as trashed", () => {
    expect(isTrashed(song("a", STAMP))).toBe(true)
  })
})

describe("partitionTrashed", () => {
  it("splits the library keeping each side's order", () => {
    const { visible, trashed } = partitionTrashed([
      song("live-1"),
      song("stamp-1", STAMP),
      song("live-2"),
      song("stamp-2", STAMP),
    ])

    expect(visible.map((entry) => entry.id)).toEqual(["live-1", "live-2"])
    expect(trashed.map((entry) => entry.id)).toEqual(["stamp-1", "stamp-2"])
  })

  it("handles empty and all-trashed inputs", () => {
    expect(partitionTrashed([])).toEqual({ visible: [], trashed: [] })

    const only = partitionTrashed([song("x", STAMP)])
    expect(only.visible).toEqual([])
    expect(only.trashed.map((entry) => entry.id)).toEqual(["x"])
  })
})

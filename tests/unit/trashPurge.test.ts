/**
 * The scheduled trash purge's pure core (roadmap #31's tail, shipped with
 * P0.1): the cutoff maths and the batch chunking, with no database in sight.
 * The real query and the real cascade run against the emulator in
 * `tests/integration/trashPurge.test.ts`.
 */
import { describe, expect, it } from "vitest"

import { TRASH_TTL_DAYS, chunksOf, expiredBefore } from "../../functions/src/purge"

describe("TRASH_TTL_DAYS", () => {
  it("is the 30 days the trash screen promises", () => {
    expect(TRASH_TTL_DAYS).toBe(30)
  })
})

describe("expiredBefore", () => {
  it("counts 30 exact days back from the moment of the run", () => {
    const now = new Date("2026-10-16T04:17:00.000Z")
    expect(expiredBefore(now).toISOString()).toBe("2026-09-16T04:17:00.000Z")
  })

  it("is pure UTC arithmetic, so a midnight on a DST boundary cannot bend it", () => {
    const now = new Date("2026-10-25T01:30:00.000Z")
    expect(expiredBefore(now).getTime()).toBe(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  })
})

describe("chunksOf", () => {
  it("keeps the order and every run at the given size", () => {
    expect(chunksOf([1, 2, 3, 4, 5], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ])
  })

  it("leaves a run of the exact size as a single chunk", () => {
    expect(chunksOf([1, 2, 3, 4], 4)).toEqual([[1, 2, 3, 4]])
  })

  it("returns nothing for an empty list", () => {
    expect(chunksOf([], 100)).toEqual([])
  })

  it("never loops forever on a zero or negative size", () => {
    expect(chunksOf([1, 2, 3], 0)).toEqual([[1], [2], [3]])
    expect(chunksOf([1, 2, 3], -5)).toEqual([[1], [2], [3]])
  })

  it("preserves a batch-sized run exactly as the writer sees it", () => {
    const targets = Array.from({ length: 401 }, (_, i) => i)
    expect(chunksOf(targets, 400)).toEqual([targets.slice(0, 400), targets.slice(400)])
  })
})

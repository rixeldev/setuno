import { describe, expect, it } from "vitest"

import type { Song } from "@/interfaces"
import type { TimestampLike } from "@/interfaces/timestamp"
import { editIsStale, songStamp } from "@/libs/songConflict"

const stamp = (millis: number): TimestampLike => ({
  seconds: Math.floor(millis / 1000),
  nanoseconds: 0,
  toDate: () => new Date(millis),
})

const song = (updatedAt?: TimestampLike): Song => ({ id: "s1", updatedAt } as unknown as Song)

describe("songStamp", () => {
  it("reads the save instant in milliseconds", () => {
    expect(songStamp(song(stamp(1_700_000_000_000)))).toBe(1_700_000_000_000)
  })

  it("reports null without a song or without a usable stamp", () => {
    expect(songStamp(null)).toBeNull()
    expect(songStamp(undefined)).toBeNull()
    expect(songStamp({ id: "s1" } as unknown as Song)).toBeNull()
  })
})

describe("editIsStale", () => {
  it("never flags a draft with nothing to compare against", () => {
    expect(editIsStale(song(stamp(2_000)), null)).toBe(false)
  })

  it("stays quiet while the live document still matches the draft", () => {
    expect(editIsStale(song(stamp(2_000)), songStamp(song(stamp(2_000))))).toBe(false)
  })

  it("flags a save that landed after the editor loaded the song", () => {
    expect(editIsStale(song(stamp(3_000)), songStamp(song(stamp(2_000))))).toBe(true)
  })

  it("does not cry conflict while the stamp has not resolved", () => {
    expect(editIsStale(song(undefined), 2_000)).toBe(false)
    expect(editIsStale(null, 2_000)).toBe(false)
    expect(editIsStale(undefined, 2_000)).toBe(false)
  })
})

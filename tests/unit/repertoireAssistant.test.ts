import { describe, expect, it } from "vitest"

import {
  ASSISTANT_DEFAULT_MINUTES,
  ASSISTANT_MAX_SONGS,
  buildRepertoireDraft,
  type RepertoireSong,
} from "@/libs/repertoireAssistant"
import type { SongUsage } from "@/libs/songUsage"

/**
 * The repertoire assistant (roadmap #86): the slot, the rotation and the
 * energy arc — all deterministic, so the same band always gets the same draft.
 */

const song = (
  id: string,
  overrides: Partial<RepertoireSong> = {},
): RepertoireSong => ({
  id,
  title: id.toUpperCase(),
  bpm: 100,
  durationSec: 180,
  ...overrides,
})

const usage = (entries: Record<string, SongUsage>): Map<string, SongUsage> =>
  new Map(Object.entries(entries))

describe("buildRepertoireDraft", () => {
  it("fills the slot the band asked for", () => {
    const draft = buildRepertoireDraft({
      songs: [song("a"), song("b"), song("c"), song("d")],
      usage: usage({}),
      targetMinutes: 10,
    })
    // Three-minute songs into a ten-minute slot: four of them, twelve minutes.
    expect(draft.songIds).toHaveLength(4)
    expect(draft.addedSec).toBe(720)
    expect(draft.goalSec).toBe(600)
    expect(draft.reachedGoal).toBe(true)
  })

  it("lets the break eat into the slot, exactly like the setlist's own goal", () => {
    const draft = buildRepertoireDraft({
      songs: [song("a")],
      usage: usage({}),
      targetMinutes: 45,
      breakMinutes: 10,
    })
    expect(draft.goalSec).toBe(35 * 60)
  })

  it("counts the music the list already holds towards the goal", () => {
    const draft = buildRepertoireDraft({
      songs: [song("a"), song("b"), song("c")],
      usage: usage({}),
      existingSongIds: ["a"],
      existingSec: 300,
      targetMinutes: 10,
    })
    // 300s already, so only two more three-minute songs fit in the 600s slot.
    expect(draft.songIds).toHaveLength(2)
    expect(draft.songIds).not.toContain("a")
  })

  it("picks the neglected songs before the rest", () => {
    const draft = buildRepertoireDraft({
      songs: [song("played"), song("neglected"), song("recent")],
      usage: usage({
        played: { timesPlayed: 12, lastPlayedOn: "2026-01-01", eventsAgo: 0 },
        neglected: { timesPlayed: 1, lastPlayedOn: "2026-01-01", eventsAgo: 5 },
        recent: { timesPlayed: 8, lastPlayedOn: "2026-01-01", eventsAgo: 1 },
      }),
      // A slot only one song fits into: the first pick is the answer.
      targetMinutes: 1,
    })
    expect(draft.songIds).toEqual(["neglected"])
  })

  it("ranks a never-played song after a played one", () => {
    const draft = buildRepertoireDraft({
      songs: [song("fresh"), song("neglected")],
      usage: usage({
        neglected: { timesPlayed: 1, lastPlayedOn: "2026-01-01", eventsAgo: 5 },
      }),
      targetMinutes: 1,
    })
    expect(draft.songIds).toEqual(["neglected"])
  })

  it("arranges the draft in a tent: the driving song peaks in the middle", () => {
    const draft = buildRepertoireDraft({
      songs: [
        song("calm", { bpm: 60, durationSec: 60 }),
        song("mid", { bpm: 100, durationSec: 60 }),
        song("driving", { bpm: 160, durationSec: 60 }),
      ],
      usage: usage({}),
      targetMinutes: 10,
    })
    expect(draft.songIds).toEqual(["mid", "driving", "calm"])
  })

  it("treats a song with no tempo as neutral", () => {
    const draft = buildRepertoireDraft({
      songs: [
        song("unknown", { bpm: null, durationSec: 60 }),
        song("calm", { bpm: 60, durationSec: 60 }),
        song("driving", { bpm: 160, durationSec: 60 }),
      ],
      usage: usage({}),
      targetMinutes: 10,
    })
    // The unknown tempo is neither calm nor driving: it lands between them.
    expect(draft.songIds).toEqual(["unknown", "driving", "calm"])
  })

  it("never picks a song the list already holds", () => {
    const draft = buildRepertoireDraft({
      songs: [song("a"), song("b")],
      usage: usage({}),
      existingSongIds: ["a", "b"],
      targetMinutes: 10,
    })
    expect(draft.songIds).toEqual([])
    expect(draft.addedSec).toBe(0)
  })

  it("uses the default slot when the band set no goal", () => {
    const draft = buildRepertoireDraft({
      songs: [song("a")],
      usage: usage({}),
    })
    expect(draft.goalSec).toBe(ASSISTANT_DEFAULT_MINUTES * 60)
  })

  it("never grows past the cap, however long the slot is", () => {
    const many = Array.from({ length: 80 }, (_, index) => song(`s${index}`, { durationSec: 30 }))
    const draft = buildRepertoireDraft({
      songs: many,
      usage: usage({}),
      targetMinutes: 480,
    })
    expect(draft.songIds).toHaveLength(ASSISTANT_MAX_SONGS)
    expect(draft.skipped).toBe(80 - ASSISTANT_MAX_SONGS)
  })

  it("assumes a length for a song nobody measured", () => {
    const draft = buildRepertoireDraft({
      songs: [song("a", { durationSec: null })],
      usage: usage({}),
      targetMinutes: 10,
    })
    expect(draft.addedSec).toBeGreaterThan(0)
  })

  it("is deterministic: the same band gets the same draft", () => {
    const input = {
      songs: [song("a"), song("b"), song("c"), song("d")],
      usage: usage({
        b: { timesPlayed: 1, lastPlayedOn: "2026-01-01", eventsAgo: 4 },
      }),
      targetMinutes: 20,
    }
    expect(buildRepertoireDraft(input)).toEqual(buildRepertoireDraft(input))
  })

  it("says the slot was not reached when the pool ran out", () => {
    const draft = buildRepertoireDraft({
      songs: [song("a")],
      usage: usage({}),
      targetMinutes: 60,
    })
    expect(draft.reachedGoal).toBe(false)
    expect(draft.skipped).toBe(0)
  })
})

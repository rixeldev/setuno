import { describe, expect, it } from "vitest"

import type { ShowLogEntry } from "@/interfaces/performance"
import {
  MAX_SHOW_LOG_ENTRIES,
  SHOW_NOTE_MAX,
  buildShowReport,
  ensureShowEntry,
  markShowOutcome,
  recordVisitSeconds,
  replaceShowNote,
  sanitizeShowLog,
  showEntryFor,
  skippedSongIds,
  upsertShowEntry,
  visitSeconds,
  type ShowBreakWindow,
} from "@/libs/showLog"

const entry = (overrides: Partial<ShowLogEntry> & { songId: string }): ShowLogEntry => ({
  outcome: "played",
  actualSec: 0,
  note: "",
  updatedAt: 1_760_000_000_000,
  ...overrides,
})

describe("sanitizeShowLog", () => {
  it("rebuilds well-formed entries and drops malformed ones", () => {
    const log = sanitizeShowLog([
      entry({ songId: "a", actualSec: 180 }),
      { songId: "", outcome: "played", actualSec: 10, note: "", updatedAt: 1 },
      { outcome: "played" },
      "nope",
      null,
      entry({ songId: "b", outcome: "skipped", note: "  cut short  " }),
    ])
    expect(log.map((item) => item.songId)).toEqual(["a", "b"])
    expect(log[1]).toEqual(entry({ songId: "b", outcome: "skipped", note: "cut short" }))
  })

  it("reads an unrecognised outcome back as played", () => {
    // A mark nobody understands must never become "skipped" and lose the song
    // from history — #30's self-heal, same contract.
    const [item] = sanitizeShowLog([entry({ songId: "a", outcome: "encored" as never })])
    expect(item.outcome).toBe("played")
  })

  it("clamps time and note length, and keeps the last entry per song", () => {
    const log = sanitizeShowLog([
      entry({ songId: "a", actualSec: -5 }),
      entry({ songId: "a", actualSec: 999_999, note: "x".repeat(1000) }),
      entry({ songId: "b", actualSec: Number.NaN }),
    ])
    expect(log).toHaveLength(2)
    expect(log[0].actualSec).toBe(86_400)
    expect(log[0].note).toHaveLength(SHOW_NOTE_MAX)
    expect(log[1].actualSec).toBe(0)
  })

  it("caps the array at the rules' entry limit", () => {
    const raw = Array.from({ length: MAX_SHOW_LOG_ENTRIES + 10 }, (_, index) =>
      entry({ songId: `song-${index}` }),
    )
    expect(sanitizeShowLog(raw)).toHaveLength(MAX_SHOW_LOG_ENTRIES)
  })

  it("returns an empty log for anything that is not a list", () => {
    expect(sanitizeShowLog(undefined)).toEqual([])
    expect(sanitizeShowLog({ songId: "a" })).toEqual([])
  })
})

describe("entry writers", () => {
  it("upserts without mutating the given array", () => {
    const original = [entry({ songId: "a", note: "keep" })]
    const next = upsertShowEntry(original, entry({ songId: "a", outcome: "skipped" }))
    expect(original[0].outcome).toBe("played")
    expect(showEntryFor(next, "a")?.outcome).toBe("skipped")
    expect(upsertShowEntry(original, entry({ songId: "b" }))).toHaveLength(2)
  })

  it("ensures an entry only when the song has none yet", () => {
    const seeded = [entry({ songId: "a", outcome: "improvised", actualSec: 90, note: "solo" })]
    expect(ensureShowEntry(seeded, "a", 5)).toEqual(seeded)
    expect(ensureShowEntry(seeded, "b", 5)).toEqual([
      ...seeded,
      entry({ songId: "b", outcome: "played", actualSec: 0, note: "", updatedAt: 5 }),
    ])
  })

  it("accumulates visit seconds while preserving the mark and note", () => {
    const log = recordVisitSeconds([entry({ songId: "a", outcome: "improvised", note: "solo" })], "a", 120, 9)
    expect(log[0]).toEqual(
      entry({ songId: "a", outcome: "improvised", actualSec: 120, note: "solo", updatedAt: 9 }),
    )
    expect(recordVisitSeconds(log, "a", 45, 10)[0].actualSec).toBe(165)
    // A song with no entry yet becomes "played" with the measured time.
    expect(recordVisitSeconds(log, "b", 45, 10)[1]).toEqual(
      entry({ songId: "b", outcome: "played", actualSec: 45, updatedAt: 10 }),
    )
  })

  it("marks an outcome and edits a note without losing the other fields", () => {
    const measured = recordVisitSeconds([entry({ songId: "a" })], "a", 200, 5)
    expect(markShowOutcome(measured, "a", "skipped", 6)[0]).toEqual(
      entry({ songId: "a", outcome: "skipped", actualSec: 200, updatedAt: 6 }),
    )
    expect(replaceShowNote(measured, "a", "  cut short ", 7)[0]).toEqual(
      entry({ songId: "a", note: "cut short", actualSec: 200, updatedAt: 7 }),
    )
    // A song that was only ever noted logs as played — absent means played.
    expect(replaceShowNote([], "b", "cue", 8)[0].outcome).toBe("played")
  })
})

describe("visitSeconds", () => {
  const breaks: ShowBreakWindow[] = [{ start: 100_000, until: 160_000, end: null }]

  it("measures the plain span when the show had no break", () => {
    expect(visitSeconds(0, 240_000, [])).toBe(240)
  })

  it("subtracts the break overlapping the visit", () => {
    // A 60 s break inside a 240 s visit leaves 180 s of music.
    expect(visitSeconds(0, 240_000, breaks)).toBe(180)
  })

  it("caps an undismissed break at its scheduled end", () => {
    // Nobody dismissed the break, but the countdown was 60 s: the band was
    // back playing by 160 000 even though the window is still open.
    expect(visitSeconds(0, 300_000, breaks)).toBe(240)
  })

  it("counts an early dismissal as the break really was", () => {
    expect(visitSeconds(0, 240_000, [{ start: 100_000, until: 160_000, end: 120_000 }])).toBe(220)
  })

  it("ignores breaks outside the visit and never returns a negative", () => {
    expect(visitSeconds(200_000, 260_000, breaks)).toBe(60)
    expect(visitSeconds(10, 0, breaks)).toBe(0)
  })
})

describe("skippedSongIds", () => {
  it("collects only the songs whose last mark is skipped", () => {
    const log = [
      entry({ songId: "a", outcome: "skipped" }),
      entry({ songId: "b", outcome: "played" }),
      entry({ songId: "c", outcome: "improvised" }),
    ]
    expect([...skippedSongIds(log)]).toEqual(["a"])
    expect(skippedSongIds([]).size).toBe(0)
  })
})

describe("buildShowReport", () => {
  const durations = new Map([
    ["a", 240],
    ["b", 180],
  ])
  const durationFor = (songId: string): number | null => durations.get(songId) ?? null

  it("projects the log onto the running order with both clocks", () => {
    const report = buildShowReport(
      [
        {
          id: "set-1",
          name: "Set 1",
          songs: [
            { songId: "a", title: "A" },
            { songId: "b", title: "B" },
            { songId: "c", title: "C" },
          ],
        },
      ],
      durationFor,
      [
        entry({ songId: "a", actualSec: 270 }),
        entry({ songId: "b", outcome: "skipped" }),
      ],
    )
    const [rowA, rowB, rowC] = report.groups[0].rows
    expect(rowA.deltaSec).toBe(30)
    expect(rowB).toMatchObject({ actualSec: 0, deltaSec: -180 })
    expect(rowC).toMatchObject({ entry: null, actualSec: null, deltaSec: null })
    expect(report.totals).toEqual({
      rows: 3,
      logged: 2,
      played: 1,
      skipped: 1,
      improvised: 0,
      estimatedSec: 420,
      actualSec: 270,
    })
  })

  it("counts a song repeated across groups once", () => {
    const report = buildShowReport(
      [
        { id: "set-1", name: "Set 1", songs: [{ songId: "a", title: "A" }] },
        {
          id: "encore",
          name: "Encore",
          songs: [
            { songId: "a", title: "A" },
            { songId: "b", title: "B" },
          ],
        },
      ],
      durationFor,
      [entry({ songId: "a", actualSec: 100 })],
    )
    expect(report.groups[0].rows.map((row) => row.songId)).toEqual(["a"])
    expect(report.groups[1].rows.map((row) => row.songId)).toEqual(["b"])
    expect(report.totals.rows).toBe(2)
    expect(report.totals.actualSec).toBe(100)
  })
})

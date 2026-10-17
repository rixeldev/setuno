import { describe, expect, it } from "vitest"

import {
  SHARE_ARTIST_MAX,
  SHARE_BARS_MAX,
  SHARE_CHORDS_MAX,
  SHARE_ENTRIES_MAX,
  SHARE_EXPIRY_DAYS,
  SHARE_KEY_MAX,
  SHARE_LINE_MAX,
  SHARE_LINES_MAX,
  SHARE_PAYLOAD_BYTES_MAX,
  SHARE_SECTIONS_MAX,
  SHARE_TITLE_MAX,
  SHARE_VERSION,
  isShareToken,
  sanitizeShareTitle,
  sanitizeSharedSetlist,
  sanitizeSharedSong,
  shareExpiryAt,
} from "../../functions/src/shares"

/**
 * The share document's shape contract (roadmap #56): every value the callable
 * writes is clamped here, so a malformed or bloated source can never reach a
 * fan's screen or overflow the document. Rules cannot inspect a nested payload
 * (the `markers` precedent) — this module is the layer that pins it.
 */

const line = (text = "lyric", chords: unknown[] = [{ chord: "G", position: 0 }]) => ({
  text,
  chords,
})

const section = (overrides: Record<string, unknown> = {}) => ({
  id: "sec-a",
  type: "verse",
  label: "Verse 1",
  bars: 0,
  lines: [line()],
  ...overrides,
})

describe("sanitizeSharedSong", () => {
  it("keeps a well-formed song intact", () => {
    const payload = sanitizeSharedSong({
      artist: "The Band",
      key: "G",
      capo: 2,
      bpm: 120,
      durationSec: 240,
      sections: [section()],
    })
    expect(payload).toEqual({
      artist: "The Band",
      key: "G",
      capo: 2,
      bpm: 120,
      durationSec: 240,
      sections: [
        {
          id: "sec-a",
          type: "verse",
          label: "Verse 1",
          bars: null,
          lines: [{ text: "lyric", chords: [{ chord: "G", position: 0 }] }],
        },
      ],
    })
  })

  it("self-heals an empty document into a valid payload", () => {
    const payload = sanitizeSharedSong({})
    expect(payload.artist).toBe("")
    expect(payload.key).toBe("")
    expect(payload.capo).toBe(0)
    expect(payload.bpm).toBeNull()
    expect(payload.durationSec).toBeNull()
    expect(payload.sections).toEqual([])
  })

  it("clamps text fields to their limits", () => {
    const payload = sanitizeSharedSong({
      artist: "x".repeat(500),
      key: "H'.sis".repeat(30),
      sections: [section({ label: "y".repeat(400), lines: [line("z".repeat(900))] })],
    })
    expect(payload.artist).toHaveLength(SHARE_ARTIST_MAX)
    expect(payload.key).toHaveLength(SHARE_KEY_MAX)
    expect(payload.sections[0].label).toHaveLength(120)
    expect(payload.sections[0].lines[0].text).toHaveLength(SHARE_LINE_MAX)
  })

  it("caps the number of sections, lines and chords", () => {
    const manySections = Array.from({ length: SHARE_SECTIONS_MAX + 10 }, (_, index) =>
      section({ id: `s${index}` }),
    )
    const payload = sanitizeSharedSong({
      sections: [
        section({
          lines: Array.from({ length: SHARE_LINES_MAX + 5 }, () =>
            line("x", Array.from({ length: SHARE_CHORDS_MAX + 5 }, () => ({ chord: "Am", position: 1 }))),
          ),
        }),
        ...manySections,
      ],
    })
    expect(payload.sections).toHaveLength(SHARE_SECTIONS_MAX)
    expect(payload.sections[0].lines).toHaveLength(SHARE_LINES_MAX)
    expect(payload.sections[0].lines[0].chords).toHaveLength(SHARE_CHORDS_MAX)
  })

  it("drops malformed chords and keeps well-formed ones", () => {
    const payload = sanitizeSharedSong({
      sections: [
        section({
          lines: [
            line("x", [
              { chord: "C", position: 0 },
              { chord: "", position: 4 },
              { chord: "Dm", position: -1 },
              { chord: "F", position: "wide" },
              null,
            ]),
          ],
        }),
      ],
    })
    expect(payload.sections[0].lines[0].chords).toEqual([{ chord: "C", position: 0 }])
  })

  it("treats bars 0 or malformed as unset and clamps the counter", () => {
    const payload = sanitizeSharedSong({
      sections: [
        section({ id: "a", bars: 0 }),
        section({ id: "b", bars: 8 }),
        section({ id: "c", bars: 5_000 }),
        section({ id: "d", bars: "many" }),
      ],
    })
    expect(payload.sections.map((entry) => entry.bars)).toEqual([
      null,
      8,
      SHARE_BARS_MAX,
      null,
    ])
  })

  it("passes an unknown section type through untouched", () => {
    // The app's `SECTION_TYPES` union is the single source of truth for what
    // renders; the payload must not mirror it or every new type needs two
    // updates. `libs/shareView.ts` validates on the reading side.
    const payload = sanitizeSharedSong({ sections: [section({ type: "solo", label: "Solo" })] })
    expect(payload.sections[0].type).toBe("solo")
  })

  it("survives malformed shapes without throwing", () => {
    const payload = sanitizeSharedSong({
      sections: "not-an-array",
      artist: 42,
      capo: "two",
      bpm: Number.NaN,
      durationSec: -5,
    })
    expect(payload.sections).toEqual([])
    expect(payload.artist).toBe("")
    expect(payload.capo).toBe(0)
    expect(payload.bpm).toBeNull()
    expect(payload.durationSec).toBeNull()
    expect(() => sanitizeSharedSong({ sections: [null, 7, "x"] })).not.toThrow()
  })

  it("ignores out-of-range numeric metadata", () => {
    const payload = sanitizeSharedSong({ bpm: 100_000, durationSec: 999_999, capo: -3 })
    expect(payload.bpm).toBeNull()
    expect(payload.durationSec).toBeNull()
    expect(payload.capo).toBe(0)
  })
})

describe("sanitizeSharedSetlist", () => {
  it("keeps a well-formed running order and its date", () => {
    const payload = sanitizeSharedSetlist({
      date: "2026-11-08",
      songs: [
        {
          songId: "song-1",
          title: "Alpha",
          artist: "The Band",
          key: "D",
          note: "starts alone",
          order: 0,
        },
      ],
      blocks: [{ id: "b1", name: "Set 2", afterSongId: "song-1" }],
    })
    expect(payload.date).toBe("2026-11-08")
    expect(payload.entries).toEqual([
      { songId: "song-1", title: "Alpha", artist: "The Band", key: "D", note: "starts alone" },
    ])
    expect(payload.dividers).toEqual([{ name: "Set 2", afterSongId: "song-1" }])
  })

  it("self-heals an empty document", () => {
    const payload = sanitizeSharedSetlist({})
    expect(payload).toEqual({ date: null, entries: [], dividers: [] })
  })

  it("caps entries and clamps their text", () => {
    const payload = sanitizeSharedSetlist({
      songs: Array.from({ length: SHARE_ENTRIES_MAX + 10 }, (_, index) => ({
        songId: `s${index}`,
        title: "t".repeat(400),
        artist: "a".repeat(400),
        key: "k".repeat(40),
        note: "n".repeat(400),
      })),
    })
    expect(payload.entries).toHaveLength(SHARE_ENTRIES_MAX)
    expect(payload.entries[0].title).toHaveLength(SHARE_TITLE_MAX)
    expect(payload.entries[0].artist).toHaveLength(200)
    expect(payload.entries[0].key).toHaveLength(16)
    expect(payload.entries[0].note).toHaveLength(300)
  })

  it("nulls a divider whose anchor is missing or malformed", () => {
    const payload = sanitizeSharedSetlist({
      blocks: [
        { name: "Break", afterSongId: "" },
        { name: "Encore", afterSongId: 42 },
        { name: "Bis", afterSongId: "song-9" },
        "garbage",
      ],
    })
    expect(payload.dividers).toEqual([
      { name: "Break", afterSongId: null },
      { name: "Encore", afterSongId: null },
      { name: "Bis", afterSongId: "song-9" },
      { name: "", afterSongId: null },
    ])
  })
})

describe("sanitizeShareTitle", () => {
  it("passes a title through and clamps it", () => {
    expect(sanitizeShareTitle("Alpha")).toBe("Alpha")
    expect(sanitizeShareTitle("x".repeat(400))).toHaveLength(SHARE_TITLE_MAX)
  })

  it("self-heals non-strings to an empty title", () => {
    expect(sanitizeShareTitle(undefined)).toBe("")
    expect(sanitizeShareTitle(123)).toBe("")
  })
})

describe("shareExpiryAt", () => {
  const now = 1_760_000_000_000

  it("returns null for a never-expiring link", () => {
    expect(shareExpiryAt(null, now)).toBeNull()
  })

  it("adds the offered windows", () => {
    expect(shareExpiryAt(30, now)).toBe(now + 30 * 86_400_000)
    expect(shareExpiryAt(7, now)).toBe(now + 7 * 86_400_000)
  })
})

describe("isShareToken", () => {
  it("accepts a generated token", () => {
    expect(isShareToken("v1StGXR8Z5jdHi6BmyT8x")).toBe(true)
    expect(isShareToken("abc-DEF_123-xyz_456-UV")).toBe(true)
  })

  it("rejects anything that could escape the document path", () => {
    expect(isShareToken("../../etc/passwd")).toBe(false)
    expect(isShareToken("a/b")).toBe(false)
    expect(isShareToken("short")).toBe(false)
    expect(isShareToken("")).toBe(false)
    expect(isShareToken(null)).toBe(false)
    expect(isShareToken(42)).toBe(false)
  })
})

describe("share constants", () => {
  it("pins the offered expiries the callable validates against", () => {
    expect(SHARE_EXPIRY_DAYS).toEqual([null, 30, 7])
  })

  it("stays well under Firestore's 1 MiB document limit", () => {
    expect(SHARE_PAYLOAD_BYTES_MAX).toBeLessThan(1_048_576)
  })

  it("carries the payload contract version", () => {
    expect(SHARE_VERSION).toBe(1)
  })
})

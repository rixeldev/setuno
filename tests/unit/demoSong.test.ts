import { describe, expect, it } from "vitest"

import { wordStarts } from "@/libs/chords"
import { DEMO_SONG_ID, DEMO_SONG_TITLE, demoSongSections } from "@/libs/demoSong"

/**
 * The sample song is written straight to Firestore, so its shape is guarded
 * here: every chord must land on a real word (or be a clean progression) and
 * the title has to satisfy the security rule.
 */
describe("demo song", () => {
  it("covers the shapes the reader has to show", () => {
    expect(demoSongSections().map((section) => section.type)).toEqual([
      "intro",
      "verse",
      "chorus",
      "instrumental",
    ])
  })

  it("anchors every chord of a lyric line to a word start", () => {
    for (const section of demoSongSections()) {
      for (const line of section.lines) {
        if (line.text.trim().length === 0) continue
        const starts = wordStarts(line.text)
        for (const chord of line.chords) {
          expect(starts, `${chord.chord} in "${line.text}"`).toContain(chord.position)
        }
      }
    }
  })

  it("keeps wordless lines as a gapless chord progression", () => {
    const wordless = demoSongSections()
      .flatMap((section) => section.lines)
      .filter((line) => line.text.trim().length === 0)

    expect(wordless.length).toBeGreaterThan(0)
    for (const line of wordless) {
      expect(line.chords.length).toBeGreaterThan(1)
      expect(line.chords.map((chord) => chord.position)).toEqual(
        line.chords.map((_, index) => index),
      )
    }
  })

  it("uses a deterministic id and a title the rules accept", () => {
    expect(DEMO_SONG_ID).toBe("demo-welcome")
    expect(DEMO_SONG_TITLE.length).toBeGreaterThan(0)
    expect(DEMO_SONG_TITLE.length).toBeLessThanOrEqual(140)
  })
})

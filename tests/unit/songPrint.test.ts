import { describe, expect, it } from "vitest"

import { EMPTY_SONG_LINKS, type Song } from "@/interfaces/song"
import type { TimestampLike } from "@/interfaces/timestamp"
import {
  PRINT_SCALES,
  setlistPrintHtml,
  songPrintHtml,
  type SongPrintOptions,
} from "@/libs/songPrint"

const timestamp: TimestampLike = { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) }

const song = (overrides: Partial<Song> & Pick<Song, "id" | "title">): Song => ({
  id: overrides.id,
  organizationId: "org",
  title: overrides.title,
  artist: overrides.artist ?? "",
  key: overrides.key ?? "",
  originalKey: overrides.key ?? "C",
  capo: overrides.capo ?? 0,
  bpm: overrides.bpm ?? null,
  durationSec: overrides.durationSec ?? null,
  genre: overrides.genre ?? "",
  notes: "",
  tags: overrides.tags ?? [],
  sections: overrides.sections ?? [],
  links: EMPTY_SONG_LINKS,
  createdBy: "uid",
  createdByName: "Admin",
  createdAt: timestamp,
  updatedAt: timestamp,
})

/** Stands in for `useTranslation`'s `t`, so the sheet's labels are readable. */
const t = (key: string): string =>
  (
    {
      "songs.verse": "Verse",
      "songs.chorus": "Chorus",
      "songs.sectionFallback": "Section",
      "songs.key": "Key",
      "songs.capo": "Capo",
      "songs.bpm": "BPM",
    } as Record<string, string>
  )[key] ?? key

const options = (overrides: Partial<SongPrintOptions> = {}): SongPrintOptions => ({
  includeChords: true,
  scale: "normal",
  t,
  ...overrides,
})

/** A chord at `position` over `text`, i.e. what the editor stores. */
const at = (chord: string, position: number) => ({ chord, position })

const verse = (lines: { text: string; chords: { chord: string; position: number }[] }[]) => ({
  id: "s1",
  type: "verse" as const,
  label: "Verse 1",
  lines,
})

describe("songPrintHtml", () => {
  it("prints the chord row above the lyrics, aligned to the character", () => {
    const target = song({
      id: "1",
      title: "Wonderwall",
      key: "F#m",
      sections: [verse([{ text: "Hello world", chords: [at("F#m", 0), at("E", 6)] }])],
    })
    const html = songPrintHtml(target, options())
    expect(html).toContain("F#m   E \nHello world")
    expect(html).toContain("Key: F#m")
  })

  it("escapes anything that would otherwise be markup", () => {
    const target = song({
      id: "1",
      title: "Rock & <Roll>",
      artist: 'Bros "n" Sisters',
      sections: [verse([{ text: "a < b & c", chords: [] }])],
    })
    const html = songPrintHtml(target, options())
    expect(html).toContain("Rock &amp; &lt;Roll&gt;")
    expect(html).toContain("Bros &quot;n&quot; Sisters")
    expect(html).toContain("a &lt; b &amp; c")
    expect(html).not.toContain("a < b")
  })

  it("drops the chord row in lyrics-only mode", () => {
    const target = song({
      id: "1",
      title: "Lyrics only",
      sections: [verse([{ text: "Hello world", chords: [at("C", 0)] }])],
    })
    const html = songPrintHtml(target, options({ includeChords: false }))
    expect(html).toContain('<div class="line">Hello world</div>')
    expect(html).not.toContain("C \n")
  })

  it("prints a chord-only line as the progression itself", () => {
    const target = song({
      id: "1",
      title: "Intro",
      sections: [verse([{ text: "", chords: [at("C", 0), at("G", 4)] }])],
    })
    expect(songPrintHtml(target, options())).toContain('<div class="line">C  G</div>')
    // With no chords to show, the riff has nothing left to say.
    expect(songPrintHtml(target, options({ includeChords: false }))).not.toContain("C  G")
  })

  it("carries capo, tempo and length into the header", () => {
    const target = song({ id: "1", title: "Meta", key: "G", capo: 3, bpm: 120, durationSec: 245 })
    const html = songPrintHtml(target, options())
    expect(html).toContain("Key: G")
    expect(html).toContain("Capo: 3")
    expect(html).toContain("120 BPM")
    expect(html).toContain("4:05")
  })

  it("omits the facts it does not have", () => {
    const html = songPrintHtml(song({ id: "1", title: "Bare" }), options())
    expect(html).not.toContain("Key:")
    expect(html).not.toContain("Capo:")
    expect(html).not.toContain("BPM")
  })

  it("labels sections through t, so the sheet is localized", () => {
    const target = song({
      id: "1",
      title: "Sections",
      sections: [
        verse([{ text: "one", chords: [] }]),
        { id: "s2", type: "chorus", label: "Chorus", lines: [{ text: "two", chords: [] }] },
      ],
    })
    const html = songPrintHtml(target, options())
    expect(html).toContain("Verse 1")
    expect(html).toContain("Chorus")
  })

  it("skips sections that have nothing to print", () => {
    const target = song({
      id: "1",
      title: "Empty",
      sections: [verse([]), verse([{ text: "kept", chords: [] }])],
    })
    const html = songPrintHtml(target, options())
    expect(html.match(/<section>/g)).toHaveLength(1)
    expect(html).toContain("kept")
  })

  it("offers every scale as a bigger body", () => {
    const target = song({ id: "1", title: "Scales" })
    const sizes = PRINT_SCALES.map(
      (scale) => songPrintHtml(target, options({ scale })).match(/font-size: (\d+)pt/)?.[1],
    )
    expect(sizes).toEqual(["10", "12", "15"])
  })
})

describe("setlistPrintHtml", () => {
  const entries = [
    {
      song: song({
        id: "1",
        title: "One",
        key: "C",
        sections: [verse([{ text: "hello", chords: [at("C", 0)] }])],
      }),
      key: "C",
    },
    {
      song: song({
        id: "2",
        title: "Two",
        key: "C",
        sections: [verse([{ text: "hello", chords: [at("C", 0)] }])],
      }),
      key: "D",
    },
  ]

  it("numbers the songs and prints each in the key the setlist chose", () => {
    const html = setlistPrintHtml("Friday gig", entries, options())
    expect(html).toContain("Friday gig")
    expect(html).toContain('<p class="index">1</p>')
    expect(html).toContain('<p class="index">2</p>')
    // The second song is played in D, so its C chord is transposed up a tone.
    expect(html).toContain("Key: D")
    expect(html.match(/D\s+\nhello/)).not.toBeNull()
  })

  it("starts every chart on its own page", () => {
    expect(setlistPrintHtml("Gig", entries, options())).toContain("break-before: page")
  })

  it("lets a lyrics-only list flow, so a short set wastes no paper", () => {
    const html = setlistPrintHtml("Gig", entries, options({ includeChords: false }))
    expect(html).not.toContain("break-before: page")
  })

  it("falls back to the song's own key when the entry has none", () => {
    const html = setlistPrintHtml("Gig", [{ song: entries[0].song }], options())
    expect(html).toContain("Key: C")
    expect(html.match(/C\s+\nhello/)).not.toBeNull()
  })

  it("leaves the chords alone when the song has no key to move from", () => {
    const keyless = song({
      id: "9",
      title: "Keyless",
      sections: [verse([{ text: "hello", chords: [at("C", 0)] }])],
    })
    const html = setlistPrintHtml("Gig", [{ song: keyless, key: "D" }], options())
    expect(html).toContain("C \nhello")
  })

  it("copes with an empty running order", () => {
    const html = setlistPrintHtml("Empty", [], options())
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).not.toContain("<article")
  })
})

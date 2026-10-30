import { describe, expect, it } from "vitest"

import type { ShowNote } from "@/interfaces/performance"
import {
  MAX_SHOW_NOTES,
  SHOW_NOTE_BODY_MAX,
  appendShowNote,
  removeShowNote,
  sanitizeShowNoteBody,
  sanitizeShowNotes,
} from "@/libs/showNotes"

const note = (id: string, at: number, body = "PA died", songId = "song-1"): ShowNote => ({
  id,
  songId,
  at,
  body,
  authorId: "uid-1",
  authorName: "Julia",
})

describe("sanitizeShowNoteBody", () => {
  it("normalises line endings and trims", () => {
    expect(sanitizeShowNoteBody("  first\r\nsecond  ")).toBe("first\nsecond")
  })

  it("writes nothing for a blank note", () => {
    expect(sanitizeShowNoteBody("   \n  ")).toBeNull()
  })

  it("clamps to the stored limit without cutting an emoji in half", () => {
    const exact = "a".repeat(SHOW_NOTE_BODY_MAX)
    expect(sanitizeShowNoteBody(exact)).toBe(exact)
    const emoji = `${"a".repeat(SHOW_NOTE_BODY_MAX - 1)}😀`
    expect(sanitizeShowNoteBody(emoji)).toBe("a".repeat(SHOW_NOTE_BODY_MAX - 1))
  })
})

describe("sanitizeShowNotes", () => {
  it("heals a stored feed and drops what cannot be shown", () => {
    expect(
      sanitizeShowNotes([
        note("a", 2000),
        { id: "b", at: 1000, body: "  ", songId: "", authorId: "", authorName: "" },
        { id: "c", body: "no stamp" },
        { id: "d", at: 3000, body: "kept", songId: "", authorId: "", authorName: "" },
        null,
        "nope",
      ]),
    ).toEqual([note("a", 2000), { ...note("d", 3000, "kept", ""), authorId: "", authorName: "" }])
  })

  it("orders by time and then id so the feed never shuffles", () => {
    const healed = sanitizeShowNotes([note("b", 1000), note("a", 1000), note("c", 500)])
    expect(healed.map((entry) => entry.id)).toEqual(["c", "a", "b"])
  })

  it("makes a repeated id unique instead of losing a note", () => {
    const healed = sanitizeShowNotes([note("same", 1000), note("same", 2000)])
    expect(healed.map((entry) => entry.id)).toEqual(["same", "same-2"])
  })

  it("falls back to the stamp when an entry has no id", () => {
    expect(sanitizeShowNotes([{ at: 42, body: "x" }])[0]?.id).toBe("note-42")
  })

  it("keeps only the newest notes past the cap", () => {
    const many = Array.from({ length: MAX_SHOW_NOTES + 5 }, (_, index) =>
      note(`n-${index}`, index),
    )
    const healed = sanitizeShowNotes(many)
    expect(healed).toHaveLength(MAX_SHOW_NOTES)
    expect(healed[0]?.id).toBe("n-5")
    expect(healed.at(-1)?.id).toBe(`n-${MAX_SHOW_NOTES + 4}`)
  })

  it("takes anything that is not a list as no notes", () => {
    expect(sanitizeShowNotes(undefined)).toEqual([])
    expect(sanitizeShowNotes({ at: 1 })).toEqual([])
  })
})

describe("appendShowNote", () => {
  it("stamps the note with the song on screen and the client time", () => {
    const next = appendShowNote(
      [],
      { songId: "song-9", body: "  Cut short  ", authorId: "uid-1", authorName: "Julia" },
      1234,
    )
    expect(next).toEqual([
      {
        id: "note-1234",
        songId: "song-9",
        at: 1234,
        body: "Cut short",
        authorId: "uid-1",
        authorName: "Julia",
      },
    ])
  })

  it("writes nothing for a blank note", () => {
    const current = [note("a", 1000)]
    expect(appendShowNote(current, { songId: "", body: "  ", authorId: "u", authorName: "n" }, 2)).toEqual(
      current,
    )
  })

  it("never reuses an id inside the same millisecond", () => {
    const first = appendShowNote([], { songId: "", body: "one", authorId: "u", authorName: "n" }, 99)
    const second = appendShowNote(first, { songId: "", body: "two", authorId: "u", authorName: "n" }, 99)
    expect(second.map((entry) => entry.id)).toEqual(["note-99", "note-99-2"])
  })

  it("keeps the feed ordered when an older note arrives late", () => {
    const current = [note("late", 3000)]
    const next = appendShowNote(current, { songId: "", body: "early", authorId: "u", authorName: "n" }, 1000)
    expect(next.map((entry) => entry.id)).toEqual(["note-1000", "late"])
  })
})

describe("removeShowNote", () => {
  it("drops the note and leaves the rest alone", () => {
    const notes = [note("a", 1000), note("b", 2000)]
    expect(removeShowNote(notes, "a").map((entry) => entry.id)).toEqual(["b"])
  })

  it("does nothing for an unknown id", () => {
    const notes = [note("a", 1000)]
    expect(removeShowNote(notes, "zzz")).toEqual(notes)
  })
})

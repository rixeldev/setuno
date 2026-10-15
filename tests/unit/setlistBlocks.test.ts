import { describe, expect, it } from "vitest"

import {
  cleanBlockName,
  cleanBlocks,
  insertBlock,
  listRows,
  MAX_BLOCK_NAME,
  removeBlock,
  removeEntry,
  renameBlock,
} from "@/libs/setlistBlocks"
import type { SetlistBlock, SetlistSong } from "@/interfaces/setlist"

const song = (songId: string, order: number, note = ""): SetlistSong => ({
  songId,
  title: `Song ${songId}`,
  artist: "The Band",
  key: "G",
  order,
  note,
})

const block = (id: string, name: string, afterSongId: string | null): SetlistBlock => ({
  id,
  name,
  afterSongId,
})

/** Compact view of a rendered list, e.g. `["SET 1", "1:s1", "BREAK", "2:s2"]`. */
const shape = (songs: SetlistSong[], blocks: SetlistBlock[]): string[] =>
  listRows(songs, blocks).map((row) =>
    row.kind === "song" ? `${row.order}:${row.entry.songId}` : row.block.name,
  )

describe("listRows", () => {
  it("interleaves dividers with the songs they follow", () => {
    // Anchored after `null` (the top), after s1, and after s2 (the bottom) —
    // three different gaps a "before" anchor could not all reach.
    expect(
      shape(
        [song("s1", 0), song("s2", 1), song("s3", 2)],
        [block("b1", "SET 1", null), block("b2", "BREAK", "s1"), block("b3", "ENCORE", "s2")],
      ),
    ).toEqual(["SET 1", "1:s1", "BREAK", "2:s2", "ENCORE", "3:s3"])
  })

  it("numbers songs only — a divider never costs a position", () => {
    const rows = listRows(
      [song("s1", 0), song("s2", 1)],
      [block("b1", "SET 1", null), block("b2", "SET 2", "s1")],
    )
    expect(rows.filter((row) => row.kind === "song").map((row) => row.order)).toEqual([1, 2])
  })

  it("keeps dividers anchored to the same song in the order they were added", () => {
    expect(
      shape([song("s1", 0)], [block("b1", "FIRST", "s1"), block("b2", "SECOND", "s1")]),
    ).toEqual(["1:s1", "FIRST", "SECOND"])
  })

  it("shows a divider whose song has left after the last song instead of hiding it", () => {
    // The band wrote it; it stays visible and removable rather than silently
    // disappearing behind a delete.
    expect(
      shape([song("s1", 0)], [block("b1", "GHOST", "gone"), block("b2", "TOP", null)]),
    ).toEqual(["TOP", "1:s1", "GHOST"])
  })
})

describe("removeEntry", () => {
  const songs = [song("s1", 0), song("s2", 1), song("s3", 2)]

  it("keeps a divider in the gap its song used to fill (middle)", () => {
    const before = shape(songs, [block("b1", "BREAK", "s2")])
    expect(before).toEqual(["1:s1", "2:s2", "BREAK", "3:s3"])

    const next = removeEntry(songs, [block("b1", "BREAK", "s2")], "s2")
    expect(shape(next.songs, next.blocks)).toEqual(["1:s1", "BREAK", "2:s3"])
  })

  it("moves a divider to the top when the song after it was first", () => {
    const next = removeEntry(songs, [block("b1", "SET 1", "s1")], "s1")
    expect(shape(next.songs, next.blocks)).toEqual(["SET 1", "1:s2", "2:s3"])
  })

  it("keeps a divider last when the song after it was last", () => {
    const next = removeEntry(songs, [block("b1", "ENCORE", "s3")], "s3")
    expect(shape(next.songs, next.blocks)).toEqual(["1:s1", "2:s2", "ENCORE"])
  })

  it("leaves every other divider anchored to its own song", () => {
    const next = removeEntry(songs, [block("b1", "BREAK", "s2")], "s1")
    expect(shape(next.songs, next.blocks)).toEqual(["1:s2", "BREAK", "2:s3"])
  })

  it("does nothing when the song is not in the list", () => {
    const next = removeEntry(songs, [block("b1", "BREAK", "s2")], "nope")
    expect(next.songs.map((entry) => entry.songId)).toEqual(["s1", "s2", "s3"])
    expect(next.blocks).toEqual([block("b1", "BREAK", "s2")])
  })
})

describe("editing dividers", () => {
  it("adds one after a song, with an id of its own", () => {
    const [first] = insertBlock([], " Set 1 ", null)
    expect(first.name).toBe("Set 1")
    expect(first.afterSongId).toBeNull()
    expect(first.id).not.toBe("")
    // Appending keeps the first list untouched (state updates read it).
    const both = insertBlock([first], "BREAK", "s1")
    expect(both).toHaveLength(2)
    expect(both[1]).toMatchObject({ name: "BREAK", afterSongId: "s1" })
    expect(both[1].id).not.toBe(first.id)
  })

  it("renames by id, trimming as it goes", () => {
    const blocks = [block("b1", "SET 1", null), block("b2", "SET 2", "s1")]
    expect(renameBlock(blocks, "b1", "  SET A  ").map((entry) => entry.name)).toEqual([
      "SET A",
      "SET 2",
    ])
    // An unknown id changes nothing rather than clearing a row.
    expect(renameBlock(blocks, "nope", "X")).toEqual(blocks)
  })

  it("removes by id and leaves the rest in order", () => {
    const blocks = [block("b1", "SET 1", null), block("b2", "SET 2", "s1")]
    expect(removeBlock(blocks, "b1").map((entry) => entry.id)).toEqual(["b2"])
    expect(removeBlock(blocks, "nope")).toHaveLength(2)
  })

  it("bounds a name and refuses an empty one", () => {
    expect(cleanBlockName("   ")).toBe("")
    expect(cleanBlockName("x".repeat(200))).toHaveLength(MAX_BLOCK_NAME)
  })
})

describe("cleanBlocks", () => {
  it("drops unnamed dividers, collides repeated ids and keeps orphans", () => {
    const cleaned = cleanBlocks([
      block("b1", "SET 1", null),
      block("b1", "SET 1 (copy)", "s1"),
      block("b2", "   ", "s1"),
      block("b3", "GHOST", "gone"),
    ])
    expect(cleaned.map((entry) => entry.id)).toEqual(["b1", "b3"])
    expect(cleaned[0].name).toBe("SET 1")
    // The orphan survives: `listRows` will render it after the last song.
    expect(cleaned[1].afterSongId).toBe("gone")
  })

  it("is idempotent, so a service write can apply it twice", () => {
    const once = cleanBlocks([block("b1", " SET 1 ", null), block("b2", "", "s1")])
    expect(cleanBlocks(once)).toEqual(once)
  })
})

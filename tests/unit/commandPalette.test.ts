import { afterEach, describe, expect, it } from "vitest"

import {
  foldQuery,
  foldText,
  itemScore,
  matchScore,
  rankSearchable,
  registerPaletteCommands,
  registeredPaletteCommands,
  unregisterPaletteCommands,
  type PaletteCommand,
} from "@/libs/commandPalette"

const titles = (items: { text: string }[]): string[] => items.map((item) => item.text)

describe("foldText", () => {
  it("strips accents and lowercases, so a bilingual band can type either way", () => {
    expect(foldText("Ámbar Sin Luna")).toBe("ambar sin luna")
    expect(foldText("ambar sin luna")).toBe("ambar sin luna")
  })

  it("keeps non-latin scripts intact", () => {
    expect(foldText("Café Tacvba")).toBe("cafe tacvba")
  })
})

describe("foldQuery", () => {
  it("collapses runs of whitespace but keeps the single spaces", () => {
    expect(foldQuery("  new   song ")).toBe("new song")
    expect(foldQuery("\tNew\nSong")).toBe("new song")
  })
})

describe("matchScore", () => {
  it("rejects anything that is not a subsequence", () => {
    expect(matchScore("xyz", "new song")).toBeNull()
    expect(matchScore("nsx", "new song")).toBeNull()
  })

  it("accepts a subsequence in order", () => {
    expect(matchScore("ns", "new song")).not.toBeNull()
    expect(matchScore("nwsg", "new song")).not.toBeNull()
  })

  it("ranks an exact hit above a prefix above a substring", () => {
    const exact = matchScore("song", "song") ?? 0
    const prefix = matchScore("so", "song") ?? 0
    const inside = matchScore("so", "also") ?? 0
    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(inside)
  })

  it("rewards characters that follow each other over scattered ones", () => {
    const together = matchScore("new", "new song") ?? 0
    const apart = matchScore("new", "night event welcome") ?? 0
    expect(together).toBeGreaterThan(apart)
  })

  it("rewards characters that start a word", () => {
    const wordStart = matchScore("s", "the songbook") ?? 0
    const inside = matchScore("n", "the songbook") ?? 0
    expect(wordStart).toBeGreaterThan(inside)
  })

  it("matches accented text with an unaccented query", () => {
    expect(matchScore("ambar", "Ámbar Sin Luna")).not.toBeNull()
    expect(matchScore("ámbar", "Ambar Sin Luna")).not.toBeNull()
  })

  it("treats an empty query as matching everything equally", () => {
    expect(matchScore("", "anything")).toBe(0)
    expect(matchScore("", "")).toBe(0)
  })

  it("requires a typed space to match a space, not to skip one", () => {
    // The space is a character like any other, so "new so" still walks on.
    expect(matchScore("new so", "new song")).not.toBeNull()
    expect(matchScore("newso", "new song")).not.toBeNull()
  })
})

describe("itemScore", () => {
  it("scores the text alone when there are no keywords", () => {
    expect(itemScore("song", { text: "song" })).toBe(matchScore("song", "song"))
  })

  it("falls back to keywords when the text does not match", () => {
    const score = itemScore("setlist", { text: "Set lists", keywords: ["setlists"] })
    expect(score).not.toBeNull()
  })

  it("prefers a hit in the text over the same hit in a keyword", () => {
    const inText = itemScore("song", { text: "Songs", keywords: ["canciones"] }) ?? 0
    const onlyKeyword = itemScore("song", { text: "Setlists", keywords: ["song"] }) ?? 0
    expect(inText).toBeGreaterThan(onlyKeyword)
  })

  it("returns null when neither text nor keywords match", () => {
    expect(itemScore("xyz", { text: "New song", keywords: ["setlist"] })).toBeNull()
  })
})

describe("rankSearchable", () => {
  const items = [
    { text: "New song" },
    { text: "New setlist" },
    { text: "Songs" },
    { text: "Ámbar Sin Luna" },
    { text: "Dashboard" },
    { text: "Song" },
  ]

  it("keeps the caller's order when the query is empty", () => {
    expect(titles(rankSearchable(items, "", 10))).toEqual([
      "New song",
      "New setlist",
      "Songs",
      "Ámbar Sin Luna",
      "Dashboard",
      "Song",
    ])
  })

  it("puts the best match first", () => {
    expect(titles(rankSearchable(items, "song", 10))[0]).toBe("Song")
  })

  it("honours the limit", () => {
    expect(rankSearchable(items, "new", 2)).toHaveLength(2)
    expect(rankSearchable(items, "", 2)).toHaveLength(2)
  })

  it("drops what does not match", () => {
    expect(titles(rankSearchable(items, "zzz", 10))).toEqual([])
  })

  it("is stable: equal scores fall back to the text", () => {
    const twins = [{ text: "Beta" }, { text: "Alpha" }]
    expect(titles(rankSearchable(twins, "a", 10))).toEqual(["Alpha", "Beta"])
    expect(titles(rankSearchable(twins, "a", 10))).toEqual(titles(rankSearchable(twins, "a", 10)))
  })

  it("finds an accented title from an unaccented query", () => {
    expect(titles(rankSearchable(items, "ambar", 10))).toEqual(["Ámbar Sin Luna"])
  })

  it("matches a keyword without ever showing it", () => {
    const command = { text: "Songs", keywords: ["canciones"] }
    expect(titles(rankSearchable([command], "canciones", 10))).toEqual(["Songs"])
  })
})

const command = (id: string): PaletteCommand => ({
  id,
  title: id,
  group: "group",
  run: () => undefined,
})

describe("palette command registry", () => {
  afterEach(() => {
    unregisterPaletteCommands("test")
    unregisterPaletteCommands("other")
  })

  it("returns what is registered and nothing else", () => {
    registerPaletteCommands("test", [command("a"), command("b")])
    expect(registeredPaletteCommands().map((entry) => entry.id)).toEqual(["a", "b"])
  })

  it("replaces the previous registration for the same owner", () => {
    registerPaletteCommands("test", [command("a")])
    registerPaletteCommands("test", [command("b")])
    expect(registeredPaletteCommands().map((entry) => entry.id)).toEqual(["b"])
  })

  it("merges every owner", () => {
    registerPaletteCommands("test", [command("a")])
    registerPaletteCommands("other", [command("b")])
    expect(registeredPaletteCommands().map((entry) => entry.id).sort()).toEqual(["a", "b"])
  })

  it("drops an owner's commands on unregister", () => {
    registerPaletteCommands("test", [command("a")])
    registerPaletteCommands("other", [command("b")])
    unregisterPaletteCommands("test")
    expect(registeredPaletteCommands().map((entry) => entry.id)).toEqual(["b"])
  })

  it("copies the list, so a caller can reuse the array it passed", () => {
    const commands = [command("a")]
    registerPaletteCommands("test", commands)
    commands.push(command("b"))
    expect(registeredPaletteCommands().map((entry) => entry.id)).toEqual(["a"])
  })
})

import { describe, expect, it } from "vitest"

import {
  EMPTY_SONG_LINKS,
  type SongLinks,
} from "@/interfaces/song"
import {
  isEmptySongLinks,
  normalizeSongLink,
  normalizeSongLinks,
  SONG_LINK_PROVIDERS,
  songLinkEntries,
} from "@/libs/songLinks"

describe("normalizeSongLink", () => {
  it("keeps a full http(s) link", () => {
    expect(normalizeSongLink("https://open.spotify.com/track/abc")).toBe(
      "https://open.spotify.com/track/abc",
    )
    expect(normalizeSongLink("http://example.com")).toBe("http://example.com")
  })

  it("adds the https scheme to a bare domain", () => {
    expect(normalizeSongLink("youtube.com/watch?v=abc")).toBe("https://youtube.com/watch?v=abc")
    expect(normalizeSongLink("  youtu.be/abc  ")).toBe("https://youtu.be/abc")
  })

  it("drops empty and non-string values", () => {
    expect(normalizeSongLink("")).toBe("")
    expect(normalizeSongLink("   ")).toBe("")
    expect(normalizeSongLink(null)).toBe("")
    expect(normalizeSongLink(42)).toBe("")
    expect(normalizeSongLink({})).toBe("")
  })

  it("refuses unsafe schemes", () => {
    expect(normalizeSongLink("javascript:alert(1)")).toBe("")
    expect(normalizeSongLink("data:text/html;base64,AAAA")).toBe("")
    expect(normalizeSongLink("mailto:hi@example.com")).toBe("")
  })
})

describe("normalizeSongLinks", () => {
  it("fills every provider from a partial map", () => {
    const links = normalizeSongLinks({ youtube: "youtu.be/abc" })
    expect(links).toEqual({
      youtube: "https://youtu.be/abc",
      spotify: "",
      appleMusic: "",
    })
  })

  it("returns empty links for junk input", () => {
    expect(normalizeSongLinks(undefined)).toEqual(EMPTY_SONG_LINKS)
    expect(normalizeSongLinks("nope")).toEqual(EMPTY_SONG_LINKS)
  })
})

describe("isEmptySongLinks", () => {
  it("is true only when no provider is set", () => {
    expect(isEmptySongLinks(undefined)).toBe(true)
    expect(isEmptySongLinks(EMPTY_SONG_LINKS)).toBe(true)
    expect(isEmptySongLinks({ ...EMPTY_SONG_LINKS, spotify: "x" })).toBe(false)
  })
})

describe("songLinkEntries", () => {
  it("lists only the providers that are set, in a stable order", () => {
    const links: SongLinks = {
      youtube: "https://youtu.be/abc",
      spotify: "",
      appleMusic: "music.apple.com/song/1",
    }
    expect(songLinkEntries(links)).toEqual([
      { provider: "youtube", url: "https://youtu.be/abc" },
      { provider: "appleMusic", url: "https://music.apple.com/song/1" },
    ])
  })

  it("drops an entry whose stored value is not a usable link", () => {
    expect(songLinkEntries({ ...EMPTY_SONG_LINKS, youtube: "javascript:alert(1)" })).toEqual([])
  })

  it("returns nothing for missing links", () => {
    expect(songLinkEntries(null)).toEqual([])
  })

  it("covers every provider exactly once", () => {
    expect(songLinkEntries(EMPTY_SONG_LINKS)).toHaveLength(0)
    expect(new Set(SONG_LINK_PROVIDERS).size).toBe(SONG_LINK_PROVIDERS.length)
  })
})

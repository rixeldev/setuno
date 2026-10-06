import { describe, expect, it } from "vitest"

import { findSetlistNavigation } from "@/libs/setlistNavigation"
import type { Performance, Setlist } from "@/interfaces"

const TODAY = "2026-10-06"

const setlist = (id: string, songIds: string[]): Setlist =>
  ({
    id,
    name: id,
    songs: songIds.map((songId) => ({ songId, title: songId, artist: "", key: "" })),
  }) as unknown as Setlist

const performance = (
  id: string,
  date: string,
  setlistIds: string[],
  status: Performance["status"] = "scheduled",
): Performance =>
  ({
    id,
    date,
    endDate: null,
    status,
    setlists: setlistIds.map((setlistId) => ({ id: setlistId, name: setlistId })),
  }) as unknown as Performance

describe("setlist navigation", () => {
  it("returns null when the song is not in any setlist", () => {
    expect(
      findSetlistNavigation("a", [setlist("s1", ["b", "c"])], [performance("p1", TODAY, ["s1"])], TODAY),
    ).toBeNull()
  })

  it("ignores setlists that are not attached to an event", () => {
    expect(findSetlistNavigation("a", [setlist("s1", ["a", "b"])], [], TODAY)).toBeNull()
  })

  it("walks the running order and stops at the ends", () => {
    const lists = [setlist("s1", ["a", "b", "c"])]
    const events = [performance("p1", "2026-10-10", ["s1"])]

    expect(findSetlistNavigation("b", lists, events, TODAY)).toMatchObject({
      previousId: "a",
      nextId: "c",
    })
    expect(findSetlistNavigation("a", lists, events, TODAY)).toMatchObject({
      previousId: null,
      nextId: "b",
    })
    expect(findSetlistNavigation("c", lists, events, TODAY)).toMatchObject({
      previousId: "b",
      nextId: null,
    })
  })

  it("prefers the nearest upcoming event over past ones", () => {
    const lists = [setlist("past", ["a", "b"]), setlist("soon", ["a", "c"])]
    const events = [performance("pPast", "2026-09-01", ["past"]), performance("pSoon", "2026-10-08", ["soon"])]

    expect(findSetlistNavigation("a", lists, events, TODAY)?.setlistId).toBe("soon")
  })

  it("falls back to the most recent past event when nothing is upcoming", () => {
    const lists = [setlist("old", ["a", "b"]), setlist("recent", ["a", "c"])]
    const events = [performance("pOld", "2026-01-01", ["old"]), performance("pRecent", "2026-09-20", ["recent"])]

    expect(findSetlistNavigation("a", lists, events, TODAY)?.setlistId).toBe("recent")
  })

  it("never navigates inside a cancelled event", () => {
    const lists = [setlist("s1", ["a", "b"])]
    const events = [performance("p1", "2026-10-10", ["s1"], "cancelled")]

    expect(findSetlistNavigation("a", lists, events, TODAY)).toBeNull()
  })
})

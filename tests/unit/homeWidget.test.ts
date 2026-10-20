import { describe, expect, it } from "vitest"

import { buildHomeWidgetContent, nextWidgetEvent, type WidgetEvent } from "@/libs/homeWidget"

/**
 * The Android home-screen widget (roadmap #78): which gig the widget shows
 * and what it says about it.
 */

const event = (id: string, overrides: Partial<WidgetEvent> = {}): WidgetEvent => ({
  id,
  name: `Gig ${id}`,
  date: "2026-10-21",
  venue: "The Blue Room",
  setlistNames: [],
  status: "scheduled",
  ...overrides,
})

describe("nextWidgetEvent", () => {
  it("picks the soonest gig from today on", () => {
    const next = nextWidgetEvent(
      [
        event("late", { date: "2026-11-02" }),
        event("soon", { date: "2026-10-22" }),
        event("today", { date: "2026-10-20" }),
      ],
      "2026-10-20",
    )
    expect(next?.id).toBe("today")
  })

  it("ignores the gigs that already happened", () => {
    const next = nextWidgetEvent([event("past", { date: "2026-10-19" })], "2026-10-20")
    expect(next).toBeNull()
  })

  it("ignores cancelled and finished events", () => {
    const next = nextWidgetEvent(
      [
        event("cancelled", { status: "cancelled" }),
        event("done", { status: "completed" }),
        event("real", { date: "2026-10-25" }),
      ],
      "2026-10-20",
    )
    expect(next?.id).toBe("real")
  })

  it("breaks a tie on the same day by id, so the widget never wobbles", () => {
    const next = nextWidgetEvent([event("b"), event("a")], "2026-10-20")
    expect(next?.id).toBe("a")
  })

  it("answers null when the band has nothing scheduled", () => {
    expect(nextWidgetEvent([], "2026-10-20")).toBeNull()
  })
})

describe("buildHomeWidgetContent", () => {
  it("shows the gig, when it is, where and what they will play", () => {
    const content = buildHomeWidgetContent({
      bandName: "The Riverside Blues",
      event: event("abc", { setlistNames: ["Set 1", "Encore"] }),
      when: "Tomorrow",
      nothingScheduled: "No gigs scheduled.",
    })
    expect(content.bandName).toBe("The Riverside Blues")
    expect(content.title).toBe("Gig abc")
    expect(content.subtitle).toBe("Tomorrow · The Blue Room")
    expect(content.detail).toBe("Set 1 · Encore")
    expect(content.route).toBe("performances/abc")
  })

  it("says so when there is nothing scheduled, instead of going blank", () => {
    const content = buildHomeWidgetContent({
      bandName: "The Riverside Blues",
      event: null,
      when: "",
      nothingScheduled: "No gigs scheduled.",
    })
    expect(content.title).toBe("No gigs scheduled.")
    expect(content.subtitle).toBe("")
    expect(content.detail).toBe("")
    expect(content.route).toBe("")
  })

  it("leaves out the parts it does not have", () => {
    const content = buildHomeWidgetContent({
      bandName: "Band",
      event: event("abc", { venue: "", setlistNames: [] }),
      when: "Saturday",
      nothingScheduled: "Nothing",
    })
    expect(content.subtitle).toBe("Saturday")
    expect(content.detail).toBe("")
  })
})

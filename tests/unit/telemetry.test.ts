import { describe, expect, it } from "vitest"

import {
  FUNNEL_EVENT_NAMES,
  FUNNEL_EVENTS,
  firstFunnelEvent,
  isValidFunnelEvent,
  setPendingSignupConsent,
  takePendingSignupConsent,
} from "@/libs/telemetry"

describe("FUNNEL_EVENTS", () => {
  it("holds nine unique names Firebase would accept", () => {
    expect(FUNNEL_EVENT_NAMES).toHaveLength(9)
    expect(new Set(FUNNEL_EVENT_NAMES).size).toBe(9)
    expect(FUNNEL_EVENT_NAMES.every(isValidFunnelEvent)).toBe(true)
  })

  it("keeps the owner's funnel verbatim", () => {
    expect(FUNNEL_EVENT_NAMES).toEqual([
      "sign_up_completed",
      "first_song_created",
      "first_setlist",
      "first_performance",
      "reader_opened",
      "stage_mode_enabled",
      "chord_sheet_opened",
      "suggestion_created",
      "suggestion_resolved",
    ])
  })
})

describe("isValidFunnelEvent", () => {
  it("rejects the names Firebase emits by itself", () => {
    for (const reserved of ["first_open", "session_start", "error", "app_update", "user_engagement", "ad_click"]) {
      expect(isValidFunnelEvent(reserved)).toBe(false)
    }
  })

  it("rejects shapes Firebase would reject", () => {
    expect(isValidFunnelEvent("First_Song")).toBe(false)
    expect(isValidFunnelEvent("1st_song")).toBe(false)
    expect(isValidFunnelEvent("first-song")).toBe(false)
    expect(isValidFunnelEvent(`a${"b".repeat(40)}`)).toBe(false)
    expect(isValidFunnelEvent("")).toBe(false)
  })
})

describe("firstFunnelEvent", () => {
  it("fires exactly on the zero-to-one transition", () => {
    const event = FUNNEL_EVENTS.firstSongCreated
    expect(firstFunnelEvent(0, event)).toBe(event)
    expect(firstFunnelEvent(1, event)).toBeNull()
    expect(firstFunnelEvent(5, event)).toBeNull()
  })
})

describe("the sign-up consent handshake", () => {
  it("hands the answer over exactly once", () => {
    expect(takePendingSignupConsent()).toBeNull()
    setPendingSignupConsent(true)
    expect(takePendingSignupConsent()).toBe(true)
    expect(takePendingSignupConsent()).toBeNull()
  })

  it("keeps the latest answer and records declines too", () => {
    setPendingSignupConsent(true)
    setPendingSignupConsent(false)
    expect(takePendingSignupConsent()).toBe(false)
    expect(takePendingSignupConsent()).toBeNull()
  })
})

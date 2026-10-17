import { describe, expect, it } from "vitest"

import {
  PUSH_NOTIFICATION_TYPES,
  buildPushMessage,
  chunkMessages,
  isPushLanguage,
  parseTicketFailures,
  pushTypeEnabled,
  type PushLanguage,
} from "../../functions/src/notify"

/** Every message ships in both app languages (roadmap #52). */
const LANGS: readonly PushLanguage[] = ["en", "es"]

describe("pushTypeEnabled", () => {
  it("treats a missing map as everything enabled", () => {
    expect(pushTypeEnabled(null, "suggestionCreated")).toBe(true)
    expect(pushTypeEnabled(undefined, "performanceCreated")).toBe(true)
    expect(pushTypeEnabled({}, "invitationReceived")).toBe(true)
    expect(pushTypeEnabled({ notifications: {} }, "membershipChanged")).toBe(true)
    expect(pushTypeEnabled({ notifications: { suggestionResolved: true } }, "suggestionResolved")).toBe(true)
  })

  it("honours an opt-out only for its own type", () => {
    const preferences = { notifications: { performanceCreated: false } }
    expect(pushTypeEnabled(preferences, "performanceCreated")).toBe(false)
    expect(pushTypeEnabled(preferences, "suggestionCreated")).toBe(true)
    expect(pushTypeEnabled(preferences, "invitationReceived")).toBe(true)
  })
})

describe("buildPushMessage", () => {
  it("has a non-empty title and body for every type in both languages", () => {
    for (const lang of LANGS) {
      for (const type of PUSH_NOTIFICATION_TYPES) {
        const message = buildPushMessage(type, lang)
        expect(message.title.trim().length).toBeGreaterThan(0)
        expect(message.body.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it("spells the band, the song and the actor from the context", () => {
    const message = buildPushMessage("suggestionCreated", "en", {
      bandName: "The Wrens",
      songTitle: "Kinder",
      actorName: "Ada",
    })
    expect(message.title).toContain("The Wrens")
    expect(message.body).toContain('"Kinder"')
    expect(message.body).toContain("Ada")
  })

  it("falls back to anonymous wording without a context", () => {
    const message = buildPushMessage("suggestionCreated", "es")
    expect(message.body).toContain("Un miembro")
    expect(message.body).not.toContain("undefined")
  })

  it("tells an acceptance from a rejection", () => {
    for (const lang of LANGS) {
      const accepted = buildPushMessage("suggestionResolved", lang, { status: "accepted" })
      const rejected = buildPushMessage("suggestionResolved", lang, { status: "rejected" })
      expect(rejected.body).not.toBe(accepted.body)
    }
  })

  it("tells a removal from a plain role change", () => {
    for (const lang of LANGS) {
      const removed = buildPushMessage("membershipChanged", lang, {
        bandName: "The Wrens",
        membership: "removed",
      })
      const role = buildPushMessage("membershipChanged", lang, {
        bandName: "The Wrens",
        membership: "role",
      })
      expect(removed.title).not.toBe(role.title)
      expect(removed.body).not.toBe(role.body)
    }
  })

  it("names the actor and the song in mentions and assignments (roadmap #58)", () => {
    for (const lang of LANGS) {
      for (const type of ["commentMentioned", "suggestionAssigned"] as const) {
        const message = buildPushMessage(type, lang, {
          actorName: "Ada",
          songTitle: "Kinder",
        })
        expect(message.body).toContain("Ada")
        expect(message.body).toContain('"Kinder"')
      }
    }
  })
})

describe("chunkMessages", () => {
  it("caps every batch at the push service's 100-message limit", () => {
    const items = Array.from({ length: 250 }, (_, index) => index)
    expect(chunkMessages(items).map((batch) => batch.length)).toEqual([100, 100, 50])
  })

  it("passes a small batch through and an empty list as no batches", () => {
    expect(chunkMessages(["a", "b"])).toEqual([["a", "b"]])
    expect(chunkMessages([])).toEqual([])
  })
})

describe("parseTicketFailures", () => {
  const tokens = ["tok-a", "tok-b", "tok-c"]

  it("keeps only errors, paired with their own token by position", () => {
    const failures = parseTicketFailures(
      [
        { status: "ok" },
        { status: "error", details: { error: "DeviceNotRegistered" } },
        { status: "error", details: { error: "MessageTooBig" } },
      ],
      tokens,
    )
    expect(failures).toEqual([
      { token: "tok-b", reason: "DeviceNotRegistered" },
      { token: "tok-c", reason: "MessageTooBig" },
    ])
  })

  it("ignores an error with no code", () => {
    expect(parseTicketFailures([{ status: "error" }], tokens)).toEqual([])
  })

  it("ignores a ticket that has no token to attribute it to", () => {
    expect(
      parseTicketFailures([{ status: "error", details: { error: "DeviceNotRegistered" } }], []),
    ).toEqual([])
  })

  it("survives a missing ticket list", () => {
    expect(parseTicketFailures(undefined, tokens)).toEqual([])
  })
})

describe("isPushLanguage", () => {
  it("accepts exactly the two shipped languages", () => {
    expect(isPushLanguage("en")).toBe(true)
    expect(isPushLanguage("es")).toBe(true)
    expect(isPushLanguage("fr")).toBe(false)
    expect(isPushLanguage(undefined)).toBe(false)
    expect(isPushLanguage(1)).toBe(false)
  })
})

import { describe, expect, it } from "vitest"

import {
  DIRECTORY_NAME_MAX,
  JOIN_REQUEST_NOTE_MAX,
  JOIN_REQUEST_STATUSES,
  directoryName,
  directoryNameKey,
  joinRequestNote,
  normalizeJoinRequestStatus,
} from "@/libs/joinRequests"

describe("JOIN_REQUEST_STATUSES", () => {
  it("lists every state an ask can be in", () => {
    expect([...JOIN_REQUEST_STATUSES]).toEqual(["pending", "approved", "rejected"])
  })
})

describe("normalizeJoinRequestStatus", () => {
  it("keeps the three real statuses", () => {
    expect(normalizeJoinRequestStatus("pending")).toBe("pending")
    expect(normalizeJoinRequestStatus("approved")).toBe("approved")
    expect(normalizeJoinRequestStatus("rejected")).toBe("rejected")
  })

  it("self-heals anything unrecognised back to pending", () => {
    // Stored statuses come from untrusted documents: a stray value must read
    // as a still-waiting ask (the normalizeSongStatus precedent), never as an
    // approval somebody granted themselves.
    expect(normalizeJoinRequestStatus(undefined)).toBe("pending")
    expect(normalizeJoinRequestStatus(null)).toBe("pending")
    expect(normalizeJoinRequestStatus("APPROVED")).toBe("pending")
    expect(normalizeJoinRequestStatus(7)).toBe("pending")
  })
})

describe("directoryName", () => {
  it("keeps the display casing and builds the lowercase search key", () => {
    expect(directoryName("The Midnight Riders")).toEqual({
      name: "The Midnight Riders",
      nameKey: "the midnight riders",
    })
  })

  it("trims and collapses internal whitespace", () => {
    expect(directoryName("  The   Wrens  ")).toEqual({
      name: "The Wrens",
      nameKey: "the wrens",
    })
  })

  it("keeps accents: the key folds case, never characters", () => {
    expect(directoryName("Ámbar Ensemble")).toEqual({
      name: "Ámbar Ensemble",
      nameKey: "ámbar ensemble",
    })
  })

  it("clamps both sides to the size the rules pin", () => {
    const entry = directoryName("x".repeat(DIRECTORY_NAME_MAX + 40))
    expect(entry?.name).toHaveLength(DIRECTORY_NAME_MAX)
    expect(entry?.nameKey).toHaveLength(DIRECTORY_NAME_MAX)
  })

  it("returns null when there is nothing to publish", () => {
    expect(directoryName("")).toBeNull()
    expect(directoryName("   ")).toBeNull()
    expect(directoryName("\t\n")).toBeNull()
  })
})

describe("directoryNameKey", () => {
  it("mirrors the directory entry's key", () => {
    expect(directoryNameKey(" The Wrens ")).toBe("the wrens")
  })

  it("is null exactly when the name is empty", () => {
    expect(directoryNameKey("  ")).toBeNull()
  })
})

describe("joinRequestNote", () => {
  it("trims the ends and keeps the interior", () => {
    expect(joinRequestNote("  I play bass\nand I own a van.  ")).toBe(
      "I play bass\nand I own a van.",
    )
  })

  it("clamps to the size the rules pin", () => {
    expect(joinRequestNote("n".repeat(JOIN_REQUEST_NOTE_MAX + 50))).toHaveLength(
      JOIN_REQUEST_NOTE_MAX,
    )
  })

  it("never ends a cut inside an emoji", () => {
    // A flag emoji is a surrogate pair; slicing at the clamp could leave the
    // lone high surrogate behind (the comment clamp's precedent, #55).
    const note = `${"a".repeat(JOIN_REQUEST_NOTE_MAX - 1)}🎸`
    const cleaned = joinRequestNote(note)
    expect(cleaned).toHaveLength(JOIN_REQUEST_NOTE_MAX - 1)
    expect(cleaned.endsWith("a")).toBe(true)
  })
})

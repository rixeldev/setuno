import { describe, expect, it } from "vitest"

import {
  ValidationError,
  errorCode,
  isOfflineError,
  isPermissionError,
  toFriendlyError,
} from "@/services/errors"

describe("errorCode", () => {
  it("reads the code off a Firebase error", () => {
    expect(errorCode({ code: "auth/wrong-password" })).toBe("auth/wrong-password")
    expect(errorCode({ message: "FirebaseError: nope [code=permission-denied]" })).toBe(
      "permission-denied",
    )
  })

  it("returns null for anything else", () => {
    expect(errorCode(null)).toBeNull()
    expect(errorCode("boom")).toBeNull()
    expect(errorCode({})).toBeNull()
  })
})

describe("toFriendlyError", () => {
  it("never leaks a raw auth code at the user", () => {
    expect(toFriendlyError({ code: "auth/invalid-credential" })).toBe("Incorrect email or password.")
    expect(toFriendlyError({ code: "auth/email-already-in-use" })).toBe(
      "An account already exists for that email. Try signing in.",
    )
    expect(toFriendlyError({ code: "auth/too-many-requests" })).toContain("wait a minute")
  })

  it("explains Firestore rule failures in the user's language", () => {
    expect(toFriendlyError({ code: "permission-denied" })).toBe("Only organization admins can do that.")
    expect(toFriendlyError({ code: "unauthenticated" })).toBe("Your session expired. Please sign in again.")
  })

  it("covers storage failures", () => {
    expect(toFriendlyError({ code: "storage/unauthorized" })).toBe(
      "You don't have permission to upload that file.",
    )
    expect(toFriendlyError({ code: "storage/retry-limit-exceeded" })).toBe(
      "The upload failed after several attempts.",
    )
    expect(toFriendlyError({ code: "storage/unknown" })).toBe("The upload failed. Please try again.")
  })

  it("recognises being offline however it is reported", () => {
    expect(toFriendlyError(new Error("Network request failed"))).toBe(
      "No connection right now. Check your internet and try again.",
    )
    expect(toFriendlyError({ code: "unavailable" })).toContain("No connection")
  })

  it("passes our own validation messages straight through", () => {
    expect(toFriendlyError(new ValidationError("Give the song a title."))).toBe(
      "Give the song a title.",
    )
  })

  it("falls back to the caller's message for unknown failures", () => {
    expect(toFriendlyError(new Error("kaboom"), "We couldn't delete that song.")).toBe(
      "We couldn't delete that song.",
    )
    expect(toFriendlyError(new Error("kaboom"))).toBe("Something went wrong. Please try again.")
    expect(toFriendlyError(undefined)).toBe("Something went wrong. Please try again.")
  })

  it("hides unknown Firebase codes behind the fallback", () => {
    expect(toFriendlyError({ code: "auth/something-new" }, "Try again.")).toBe("Try again.")
  })
})

describe("error predicates", () => {
  it("spots a rules failure", () => {
    expect(isPermissionError({ code: "permission-denied" })).toBe(true)
    expect(isPermissionError({ code: "not-found" })).toBe(false)
  })

  it("spots an offline failure", () => {
    expect(isOfflineError({ code: "unavailable" })).toBe(true)
    expect(isOfflineError({ code: "auth/network-request-failed" })).toBe(true)
    expect(isOfflineError(new Error("Failed to fetch"))).toBe(true)
    expect(isOfflineError(new Error("something else"))).toBe(false)
  })
})
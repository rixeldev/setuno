import { describe, expect, it } from "vitest"

import { shouldAskForPush } from "@/libs/pushPrompt"

describe("shouldAskForPush", () => {
  it("asks while the system would still ask", () => {
    expect(shouldAskForPush(false, { permission: "undetermined", canAskAgain: true })).toBe(true)
  })

  it("asks on a fresh Android install, where the permission reads as denied", () => {
    // Android 13+ reports a permission that was never granted as "denied";
    // `canAskAgain` is what says the system dialog can still appear.
    expect(shouldAskForPush(false, { permission: "denied", canAskAgain: true })).toBe(true)
  })

  it("does not ask twice on the same install", () => {
    expect(shouldAskForPush(true, { permission: "undetermined", canAskAgain: true })).toBe(false)
  })

  it("does not ask when the permission is already granted", () => {
    expect(shouldAskForPush(false, { permission: "granted", canAskAgain: true })).toBe(false)
  })

  it("does not ask when the member blocked it for good", () => {
    expect(shouldAskForPush(false, { permission: "denied", canAskAgain: false })).toBe(false)
  })

  it("does not ask on a device without push (the web)", () => {
    expect(shouldAskForPush(false, { permission: "unavailable", canAskAgain: false })).toBe(false)
  })
})

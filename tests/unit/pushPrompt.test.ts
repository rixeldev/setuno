import { describe, expect, it } from "vitest"

import { shouldAskForPush } from "@/libs/pushPrompt"

describe("shouldAskForPush", () => {
  it("asks when the system has never been asked", () => {
    expect(shouldAskForPush(false, "undetermined")).toBe(true)
  })

  it("does not ask twice on the same install", () => {
    expect(shouldAskForPush(true, "undetermined")).toBe(false)
  })

  it("does not ask when the permission is already granted", () => {
    expect(shouldAskForPush(false, "granted")).toBe(false)
  })

  it("does not ask when the permission was blocked (the OS would not ask either)", () => {
    expect(shouldAskForPush(false, "denied")).toBe(false)
  })

  it("does not ask on a device without push (the web)", () => {
    expect(shouldAskForPush(false, "unavailable")).toBe(false)
  })
})

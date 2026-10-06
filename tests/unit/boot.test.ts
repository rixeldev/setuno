import { describe, expect, it } from "vitest"

import { isBootResolved } from "@/libs/boot"

describe("boot gate", () => {
  it("waits while auth is initializing", () => {
    expect(
      isBootResolved({
        authStatus: "initializing",
        organizationState: "loading",
        organizationDataLoading: false,
      }),
    ).toBe(false)
  })

  it("resolves for signed-out users as soon as auth settles", () => {
    expect(
      isBootResolved({
        authStatus: "signed-out",
        organizationState: "loading",
        organizationDataLoading: false,
      }),
    ).toBe(true)
  })

  it("waits for the band list of a signed-in user", () => {
    expect(
      isBootResolved({
        authStatus: "signed-in",
        organizationState: "loading",
        organizationDataLoading: false,
      }),
    ).toBe(false)
  })

  it("resolves when the signed-in user has no band yet", () => {
    expect(
      isBootResolved({
        authStatus: "signed-in",
        organizationState: "needs-organization",
        organizationDataLoading: false,
      }),
    ).toBe(true)
  })

  it("waits for the first slice of band data", () => {
    expect(
      isBootResolved({
        authStatus: "signed-in",
        organizationState: "ready",
        organizationDataLoading: true,
      }),
    ).toBe(false)
    expect(
      isBootResolved({
        authStatus: "signed-in",
        organizationState: "ready",
        organizationDataLoading: false,
      }),
    ).toBe(true)
  })
})

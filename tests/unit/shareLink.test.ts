import { afterEach, describe, expect, it } from "vitest"

import { buildShareUrl, resolveShareBaseUrl } from "../../libs/shareLink"

/**
 * Share link URLs (roadmap #56): the browser origin wins when there is one,
 * `EXPO_PUBLIC_WEB_BASE_URL` covers native builds, and a runtime with neither
 * resolves to `null` so the sheet can say the build is not configured instead
 * of printing a broken URL.
 */

const ORIGINAL_ENV = process.env.EXPO_PUBLIC_WEB_BASE_URL

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.EXPO_PUBLIC_WEB_BASE_URL
  else process.env.EXPO_PUBLIC_WEB_BASE_URL = ORIGINAL_ENV
})

describe("buildShareUrl", () => {
  it("joins base and token into the public route", () => {
    expect(buildShareUrl("https://setuno.app", "tok-123")).toBe(
      "https://setuno.app/share/tok-123",
    )
  })

  it("tolerates trailing slashes on the base", () => {
    expect(buildShareUrl("https://setuno.app///", "tok")).toBe("https://setuno.app/share/tok")
  })

  it("escapes anything unexpected in the token", () => {
    expect(buildShareUrl("https://setuno.app", "a/b?c")).toBe(
      "https://setuno.app/share/a%2Fb%3Fc",
    )
  })
})

describe("resolveShareBaseUrl", () => {
  it("returns null in a runtime with no origin and no configuration", () => {
    delete process.env.EXPO_PUBLIC_WEB_BASE_URL
    // Node has no `location`, exactly like a native build without the env var.
    expect(resolveShareBaseUrl()).toBeNull()
  })

  it("uses the configured web base when the runtime has no origin", () => {
    process.env.EXPO_PUBLIC_WEB_BASE_URL = "  https://setuno.app/ "
    expect(resolveShareBaseUrl()).toBe("https://setuno.app/")
  })

  it("rejects a configuration that is not an http(s) address", () => {
    process.env.EXPO_PUBLIC_WEB_BASE_URL = "setuno.app"
    expect(resolveShareBaseUrl()).toBeNull()
    process.env.EXPO_PUBLIC_WEB_BASE_URL = ""
    expect(resolveShareBaseUrl()).toBeNull()
  })
})

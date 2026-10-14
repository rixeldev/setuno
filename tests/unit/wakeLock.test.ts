import { afterEach, describe, expect, it, vi } from "vitest"

// The web variant is the one that runs under Node and the one where the wake
// lock can genuinely be missing, so it is the right surface to guard.
import { acquireWakeLock, releaseWakeLock } from "@/libs/wakeLock.web"

interface FakeSentinel {
  release: () => Promise<void>
  addEventListener: (type: "release", listener: () => void) => void
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("web screen wake lock", () => {
  it("no-ops when the browser has no wake lock API", async () => {
    vi.stubGlobal("navigator", {})
    await expect(acquireWakeLock()).resolves.toBeUndefined()
    await expect(releaseWakeLock()).resolves.toBeUndefined()
  })

  it("requests the screen lock and releases it", async () => {
    const release = vi.fn(async () => undefined)
    const sentinel: FakeSentinel = { release, addEventListener: vi.fn() }
    const request = vi.fn(async () => sentinel)
    vi.stubGlobal("navigator", { wakeLock: { request } })

    await acquireWakeLock()
    expect(request).toHaveBeenCalledWith("screen")

    await releaseWakeLock()
    expect(release).toHaveBeenCalledTimes(1)
  })

  it("does not request a second lock while one is held", async () => {
    const request = vi.fn(async () => ({
      release: vi.fn(async () => undefined),
      addEventListener: vi.fn(),
    }))
    vi.stubGlobal("navigator", { wakeLock: { request } })

    await acquireWakeLock()
    await acquireWakeLock()
    expect(request).toHaveBeenCalledTimes(1)

    await releaseWakeLock()
  })

  it("survives a rejected request without throwing", async () => {
    vi.stubGlobal("navigator", {
      wakeLock: {
        request: vi.fn(async () => {
          throw new Error("denied")
        }),
      },
    })
    await expect(acquireWakeLock()).resolves.toBeUndefined()
  })
})

import { describe, expect, it } from "vitest"

import {
  lastSeenLabel,
  mapDeviceSession,
  platformLabel,
  sortDevices,
} from "@/libs/deviceSessions"
import type { DeviceSession } from "@/interfaces"

/** Minimal translator: the key proves the call, `n` proves the interpolation. */
const t = (key: string, options?: Record<string, string | number>): string =>
  options && "n" in options ? `${key}:${String(options.n)}` : key

const device = (
  token: string,
  seenAt: number | null,
  platform: DeviceSession["platform"] = "android",
): DeviceSession => ({ token, platform, lastSeenAt: seenAt === null ? null : new Date(seenAt) })

describe("mapDeviceSession", () => {
  it("maps a well-formed document, whatever clock it carries", () => {
    expect(mapDeviceSession("tok-a", { token: "tok-a", platform: "android", lastSeenAt: new Date(5_000) })).toEqual({
      token: "tok-a",
      platform: "android",
      lastSeenAt: new Date(5_000),
    })
    const timestamp = { toDate: () => new Date(7_000) }
    expect(
      mapDeviceSession("tok-b", { token: "tok-b", platform: "ios", lastSeenAt: timestamp }),
    ).toEqual({ token: "tok-b", platform: "ios", lastSeenAt: new Date(7_000) })
  })

  it("takes the token from the id, so a drifted body can never point the row elsewhere", () => {
    expect(
      mapDeviceSession("tok-a", { token: "someone-elses", platform: "android", lastSeenAt: new Date(1) }),
    ).toEqual({ token: "tok-a", platform: "android", lastSeenAt: new Date(1) })
  })

  it("keeps a row it can date even when the platform is unrecognised", () => {
    expect(mapDeviceSession("tok-a", { platform: "blackberry", lastSeenAt: new Date(1) })).toEqual({
      token: "tok-a",
      platform: "unknown",
      lastSeenAt: new Date(1),
    })
  })

  it("drops a row with nothing honest to show", () => {
    expect(mapDeviceSession("tok-a", { platform: "blackberry", lastSeenAt: null })).toBeNull()
    expect(mapDeviceSession("tok-a", { platform: "android", lastSeenAt: "yesterday" })).toEqual({
      token: "tok-a",
      platform: "android",
      lastSeenAt: null,
    })
    expect(mapDeviceSession("tok-a", null)).toBeNull()
    expect(mapDeviceSession("", { platform: "android", lastSeenAt: new Date(1) })).toBeNull()
  })

  it("reads an invalid date as no date at all", () => {
    const broken = { toDate: () => new Date(Number.NaN) }
    expect(mapDeviceSession("tok-a", { platform: "ios", lastSeenAt: broken })).toEqual({
      token: "tok-a",
      platform: "ios",
      lastSeenAt: null,
    })
  })
})

describe("sortDevices", () => {
  it("lists the most recently seen device first, unreadable stamps last", () => {
    const list = [device("a", 100), device("b", 300), device("c", null), device("d", 200)]
    expect(sortDevices(list).map((entry) => entry.token)).toEqual(["b", "d", "a", "c"])
  })

  it("breaks ties on the token so every phone derives the same order", () => {
    expect(sortDevices([device("z-tok", 100), device("a-tok", 100)]).map((e) => e.token)).toEqual([
      "a-tok",
      "z-tok",
    ])
  })

  it("never mutates the input list", () => {
    const list = [device("b", 100), device("a", 200)]
    sortDevices(list)
    expect(list.map((entry) => entry.token)).toEqual(["b", "a"])
  })
})

describe("platformLabel", () => {
  it("spells the brand names and collapses everything else into one honest word", () => {
    expect(platformLabel(t, "android")).toBe("Android")
    expect(platformLabel(t, "ios")).toBe("iOS")
    expect(platformLabel(t, "unknown")).toBe("devices.otherDevice")
  })
})

describe("lastSeenLabel", () => {
  const now = 3_000_000_000

  it("answers null for an unreadable stamp so the screen picks its own words", () => {
    expect(lastSeenLabel(t, null, now)).toBeNull()
  })

  it("opens with 'just now' and switches to whole minutes at the minute", () => {
    expect(lastSeenLabel(t, new Date(now), now)).toBe("devices.justNow")
    expect(lastSeenLabel(t, new Date(now - 59_999), now)).toBe("devices.justNow")
    expect(lastSeenLabel(t, new Date(now - 60_000), now)).toBe("devices.minutesAgo:1")
    expect(lastSeenLabel(t, new Date(now - 3_599_999), now)).toBe("devices.minutesAgo:59")
  })

  it("counts hours up to two days, then whole days up to a month", () => {
    expect(lastSeenLabel(t, new Date(now - 3_600_000), now)).toBe("devices.hoursAgo:1")
    expect(lastSeenLabel(t, new Date(now - 172_799_999), now)).toBe("devices.hoursAgo:47")
    expect(lastSeenLabel(t, new Date(now - 172_800_000), now)).toBe("devices.daysAgo:2")
    expect(lastSeenLabel(t, new Date(now - 2_591_999_999), now)).toBe("devices.daysAgo:29")
  })

  it("settles into 'over a month' and treats a fast clock as now", () => {
    expect(lastSeenLabel(t, new Date(now - 2_592_000_000), now)).toBe("devices.overMonth")
    expect(lastSeenLabel(t, new Date(now + 60_000), now)).toBe("devices.justNow")
  })
})

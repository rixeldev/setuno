import { describe, expect, it } from "vitest"

import type { ActivityEvent } from "@/interfaces"
import type { TimestampLike } from "@/interfaces/timestamp"
import { countUnreadActivity, isUnreadActivity } from "@/libs/activityUnread"

const stamp = (ms: number): TimestampLike => ({
  seconds: Math.floor(ms / 1000),
  nanoseconds: 0,
  toDate: () => new Date(ms),
})

const event = (ms: number | null): ActivityEvent =>
  ({
    id: "act",
    organizationId: "org",
    type: "song_created",
    message: "added a song",
    actorId: "alice",
    actorName: "Alice",
    targetType: "song",
    targetId: null,
    createdAt: ms === null ? (null as unknown as TimestampLike) : stamp(ms),
  }) as ActivityEvent

const marker = (ms: number) => new Date(ms)

describe("isUnreadActivity", () => {
  it("counts every timestamped event as unread while no marker exists", () => {
    expect(isUnreadActivity(event(1_000), null)).toBe(true)
    expect(isUnreadActivity(event(999_999), null)).toBe(true)
  })

  it("compares strictly after the marker: equal and older are read", () => {
    const read = marker(5_000)
    expect(isUnreadActivity(event(4_000), read)).toBe(false)
    expect(isUnreadActivity(event(5_000), read)).toBe(false)
    expect(isUnreadActivity(event(6_000), read)).toBe(true)
  })

  it("treats an event without a timestamp as read, marker or not", () => {
    expect(isUnreadActivity(event(null), null)).toBe(false)
    expect(isUnreadActivity(event(null), marker(5_000))).toBe(false)
  })
})

describe("countUnreadActivity", () => {
  it("counts only the events newer than the marker", () => {
    const events = [event(1_000), event(6_000), event(5_000), event(9_000), event(null)]
    expect(countUnreadActivity(events, marker(5_000))).toBe(2)
    expect(countUnreadActivity(events, null)).toBe(4)
  })

  it("returns zero for an empty feed", () => {
    expect(countUnreadActivity([], null)).toBe(0)
  })
})

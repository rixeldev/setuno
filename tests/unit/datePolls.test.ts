import { describe, expect, it } from "vitest"

import {
  POLL_OPTION_MAX,
  POLL_TITLE_MAX,
  cleanVoteIds,
  mapPollOptions,
  pollTitle,
  pollWinner,
  sanitizeVoteOptionIds,
  sortPolls,
  tallyVotes,
  toggleOption,
  votersForOption,
} from "@/libs/datePolls"
import type { DatePoll, DatePollOption, PollVote } from "@/interfaces"

const stamp = (seconds: number) => ({
  seconds,
  nanoseconds: 0,
  toDate: () => new Date(seconds * 1000),
})

const option = (id: string, date: string, time = "", note = ""): DatePollOption => ({
  id,
  date,
  time,
  note,
})

const vote = (uid: string, optionIds: string[]): PollVote => ({
  uid,
  optionIds,
  updatedAt: stamp(100),
})

const poll = (id: string, over: Partial<DatePoll> = {}): DatePoll => ({
  id,
  organizationId: "org-1",
  title: "Summer gig",
  options: [],
  status: "open",
  winningOptionId: "",
  createdEventId: "",
  createdBy: "u1",
  createdAt: stamp(100),
  updatedAt: stamp(100),
  ...over,
})

describe("mapPollOptions", () => {
  it("keeps well-formed entries in canonical order", () => {
    expect(
      mapPollOptions([
        { id: "b", date: "2026-07-20", time: "21:00", note: "late" },
        { id: "a", date: "2026-07-12", time: "", note: "" },
      ]).map((entry) => entry.id),
    ).toEqual(["a", "b"])
  })

  it("drops malformed entries and deduplicates ids", () => {
    expect(
      mapPollOptions([
        { id: "", date: "2026-07-12" },
        { id: "a", date: "not-a-date" },
        { id: "a", date: "2026-07-12", time: "25:99" },
        { id: "a", date: "2026-07-12", time: "20:00" },
        { id: "c", date: "2026-07-13" },
        "junk",
        null,
      ]),
    ).toEqual([{ id: "a", date: "2026-07-12", time: "", note: "" }, { id: "c", date: "2026-07-13", time: "", note: "" }])
  })

  it("caps the list at the same size the rules allow", () => {
    const raw = Array.from({ length: POLL_OPTION_MAX + 4 }, (_, index) => ({
      id: `o${index}`,
      date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    }))
    expect(mapPollOptions(raw)).toHaveLength(POLL_OPTION_MAX)
    expect(mapPollOptions("not a list")).toEqual([])
  })
})

describe("pollTitle", () => {
  it("trims and bounds", () => {
    expect(pollTitle("  Friday gig  ")).toBe("Friday gig")
    expect(pollTitle("x".repeat(POLL_TITLE_MAX + 20))).toHaveLength(POLL_TITLE_MAX)
    expect(pollTitle("   ")).toBe("")
  })
})

describe("toggleOption", () => {
  it("adds and removes without mutating the input", () => {
    const current = ["a"]
    expect(toggleOption(current, "b")).toEqual(["a", "b"])
    expect(toggleOption(current, "a")).toEqual([])
    expect(current).toEqual(["a"])
  })
})

describe("cleanVoteIds / sanitizeVoteOptionIds", () => {
  it("keeps strings only, deduplicated and capped", () => {
    expect(cleanVoteIds(["a", "a", 3, "b", ""])).toEqual(["a", "b"])
    expect(cleanVoteIds("junk")).toEqual([])
  })

  it("drops ids the poll no longer holds, in the poll's order", () => {
    const options = [option("a", "2026-07-12"), option("b", "2026-07-13")]
    expect(sanitizeVoteOptionIds(["ghost", "b", "a"], options)).toEqual(["a", "b"])
  })
})

describe("tallyVotes", () => {
  it("counts each voter once per option and ignores ghosts", () => {
    const options = [option("a", "2026-07-12"), option("b", "2026-07-13")]
    const votes = [vote("u1", ["a", "b"]), vote("u2", ["a", "a"]), vote("u3", ["ghost"])]
    expect(tallyVotes(options, votes)).toEqual({ a: 2, b: 1 })
  })

  it("lists the voters of one date", () => {
    const votes = [vote("u1", ["a"]), vote("u2", ["a", "b"]), vote("u3", ["b"])]
    expect(votersForOption(votes, "a")).toEqual(["u1", "u2"])
    expect(votersForOption(votes, "ghost")).toEqual([])
  })
})

describe("pollWinner", () => {
  const options = [
    option("fri", "2026-07-12"),
    option("sat", "2026-07-13"),
    option("sun", "2026-07-14"),
  ]

  it("picks the date with the most votes", () => {
    const votes = [vote("u1", ["sat", "sun"]), vote("u2", ["sat"]), vote("u3", ["sun"])]
    expect(pollWinner(options, votes)?.id).toBe("sat")
  })

  it("breaks ties by the earliest date", () => {
    const votes = [vote("u1", ["sun"]), vote("u2", ["fri"]), vote("u3", ["sat"])]
    expect(pollWinner(options, votes)?.id).toBe("fri")
  })

  it("picks nothing when nobody voted", () => {
    expect(pollWinner(options, [])).toBeNull()
    expect(pollWinner([], [vote("u1", ["a"])])).toBeNull()
  })

  it("counts a repeated id once", () => {
    const votes = [vote("u1", ["sun", "sun"]), vote("u2", ["fri"])]
    expect(pollWinner(options, votes)?.id).toBe("fri")
  })
})

describe("sortPolls", () => {
  it("leads with the open polls, newest first, closed behind", () => {
    const polls = [
      poll("old-open", { createdAt: stamp(10) }),
      poll("new-closed", { status: "closed", createdAt: stamp(90) }),
      poll("new-open", { createdAt: stamp(50) }),
    ]
    expect(sortPolls(polls).map((entry) => entry.id)).toEqual(["new-open", "old-open", "new-closed"])
    // Never mutates the shared input.
    expect(polls.map((entry) => entry.id)).toEqual(["old-open", "new-closed", "new-open"])
  })

  it("breaks ties by id so two devices can never disagree", () => {
    const polls = [poll("b", { createdAt: stamp(5) }), poll("a", { createdAt: stamp(5) })]
    expect(sortPolls(polls).map((entry) => entry.id)).toEqual(["a", "b"])
  })
})

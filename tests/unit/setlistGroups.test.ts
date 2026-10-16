import { describe, expect, it } from "vitest"

import { groupSetlists, type SetlistGroup } from "@/libs/setlistGroups"
import type { Performance, TimestampLike } from "@/interfaces"
import type { Setlist } from "@/interfaces/setlist"

const TIMESTAMP: TimestampLike = { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) }

const setlist = (overrides: Partial<Setlist> = {}): Setlist => ({
  id: "list-1",
  organizationId: "org-1",
  name: "Friday gig",
  description: "",
  date: null,
  notes: "",
  songs: [],
  blocks: [],
  estimatedDurationSec: 0,
  targetMinutes: 0,
  breakMinutes: 0,
  template: false,
  createdBy: "uid-1",
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  ...overrides,
})

const performance = (overrides: Partial<Performance> = {}): Performance => ({
  id: "show-1",
  organizationId: "org-1",
  name: "Sala Sur",
  date: "2026-10-13",
  endDate: null,
  startTime: "20:00",
  endTime: "22:30",
  venue: { name: "Sala Sur", address: "Calle 1", notes: "" },
  notes: "",
  setlists: [],
  status: "scheduled",
  type: "gig",
  showLog: [],
  attendance: {},
  createdBy: "uid-1",
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  ...overrides,
})

interface Args {
  setlists?: Setlist[]
  performances?: Performance[]
  upcomingPerformances?: Performance[]
}

const group = ({
  setlists = [],
  performances = [],
  upcomingPerformances = [],
}: Args = {}): SetlistGroup[] =>
  groupSetlists({
    setlists,
    performances,
    upcomingPerformances,
    language: "en",
    templatesTitle: "Templates",
    unattachedTitle: "Not attached to an event",
  })

describe("groupSetlists", () => {
  it("shows nothing at all when there is nothing to show", () => {
    expect(group()).toEqual([])
  })

  it("puts templates in their own group, ahead of the events", () => {
    const templates = [setlist({ id: "t1", name: "45-min set", template: true })]
    const upcoming = [
      performance({ id: "show-1", setlists: [{ id: "l1", name: "Gig" }] }),
    ]
    const lists = group({
      setlists: [...templates, setlist({ id: "l1" })],
      performances: upcoming,
      upcomingPerformances: upcoming,
    })

    expect(lists.map((entry) => entry.kind)).toEqual(["templates", "event"])
    expect(lists[0]).toMatchObject({ key: "templates", title: "Templates" })
    expect(lists[0].lists.map((entry) => entry.id)).toEqual(["t1"])
  })

  it("keeps templates out of the 'not attached to an event' section", () => {
    // This is the whole difference between a template and a draft: both belong
    // to no event, but only one of them is meant to.
    const lists = group({
      setlists: [setlist({ id: "t1", template: true }), setlist({ id: "draft" })],
    })

    expect(lists.map((entry) => entry.kind)).toEqual(["templates", "unattached"])
    expect(lists[1].lists.map((entry) => entry.id)).toEqual(["draft"])
  })

  it("lists an upcoming show once, with its date as the subtitle", () => {
    const upcoming = [
      performance({ id: "show-1", setlists: [{ id: "l1", name: "Gig" }] }),
    ]
    const lists = group({
      setlists: [setlist({ id: "l1" })],
      performances: upcoming,
      upcomingPerformances: upcoming,
    })

    expect(lists).toHaveLength(1)
    expect(lists[0]).toMatchObject({
      kind: "event",
      key: "show-1",
      eventId: "show-1",
      title: "Sala Sur",
    })
    expect(lists[0].subtitle).toContain("13")
  })

  it("drops a show that has no list attached", () => {
    const upcoming = [performance({ id: "show-1", setlists: [] })]
    expect(group({ performances: upcoming, upcomingPerformances: upcoming })).toEqual([])
  })

  it("ignores shows that are not scheduled any more", () => {
    const cancelled = [
      performance({ id: "show-1", status: "cancelled", setlists: [{ id: "l1", name: "Gig" }] }),
    ]
    // Reached through `upcomingPerformances`, which the caller filters — the
    // grouping re-checks it so a caller mistake cannot resurrect a cancelled gig.
    expect(group({ performances: cancelled, upcomingPerformances: cancelled })).toEqual([])
  })

  it("keeps a show's list out of the 'not attached' section", () => {
    const upcoming = [performance({ id: "show-1", setlists: [{ id: "l1", name: "Gig" }] })]
    const lists = group({
      setlists: [setlist({ id: "l1" })],
      performances: upcoming,
      upcomingPerformances: upcoming,
    })

    expect(lists.filter((entry) => entry.kind === "unattached")).toEqual([])
  })

  it("hides a list an event already used, past or future", () => {
    const past = [performance({ id: "show-1", status: "completed", setlists: [{ id: "l1", name: "Old" }] })]
    // It is not in any upcoming group, and it is not a draft either: the old
    // spec says it stays reachable from its event instead.
    expect(group({ setlists: [setlist({ id: "l1" })], performances: past })).toEqual([])
  })

  it("shows a list attached to two shows under both", () => {
    const upcoming = [
      performance({ id: "show-1", setlists: [{ id: "l1", name: "Core" }] }),
      performance({ id: "show-2", setlists: [{ id: "l1", name: "Core" }] }),
    ]
    const lists = group({
      setlists: [setlist({ id: "l1" })],
      performances: upcoming,
      upcomingPerformances: upcoming,
    })

    expect(lists.map((entry) => entry.eventId)).toEqual(["show-1", "show-2"])
  })

  it("skips references to a setlist the library has lost", () => {
    const upcoming = [
      performance({ id: "show-1", setlists: [{ id: "gone", name: "Deleted" }] }),
    ]
    expect(group({ performances: upcoming, upcomingPerformances: upcoming })).toEqual([])
  })

  it("a template keeps its place even when an event also uses it", () => {
    const upcoming = [performance({ id: "show-1", setlists: [{ id: "t1", name: "Wedding" }] })]
    const lists = group({
      setlists: [setlist({ id: "t1", template: true })],
      performances: upcoming,
      upcomingPerformances: upcoming,
    })

    expect(lists.map((entry) => entry.kind)).toEqual(["templates", "event"])
    expect(lists[1].lists.map((entry) => entry.id)).toEqual(["t1"])
  })
})

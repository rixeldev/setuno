import { describe, expect, it } from "vitest"

import {
  ATTENDANCE_MAX,
  mapAttendance,
  partitionAttendance,
  sortTasks,
  taskTitle,
  TASK_TITLE_MAX,
} from "@/libs/eventLogistics"
import type { EventTask, OrganizationMember } from "@/interfaces"

const member = (uid: string, displayName = uid): OrganizationMember => ({
  uid,
  displayName,
  email: `${uid}@band.test`,
  photoURL: null,
  role: "member",
})

const stamp = (seconds: number) => ({ seconds, nanoseconds: 0, toDate: () => new Date(seconds * 1000) })

const task = (id: string, over: Partial<EventTask> = {}): EventTask => ({
  id,
  title: id,
  assignedTo: "",
  done: false,
  createdBy: "u1",
  createdAt: stamp(100),
  updatedAt: stamp(100),
  ...over,
})

describe("mapAttendance", () => {
  it("keeps only known answers under real uids", () => {
    expect(mapAttendance({ u1: "yes", u2: "maybe", u3: "no" })).toEqual({
      u1: "yes",
      u2: "maybe",
      u3: "no",
    })
  })

  it("drops invalid stored data instead of showing it", () => {
    expect(
      mapAttendance({ u1: "later", u2: 3, u3: null, "": "yes", u4: "maybe" }),
    ).toEqual({ u4: "maybe" })
    expect(mapAttendance(null)).toEqual({})
    expect(mapAttendance(["yes"])).toEqual({})
  })

  it("caps the map at the same size the rules allow", () => {
    const raw: Record<string, string> = {}
    for (let i = 0; i < ATTENDANCE_MAX + 10; i++) raw[`u${i}`] = "yes"
    expect(Object.keys(mapAttendance(raw))).toHaveLength(ATTENDANCE_MAX)
  })
})

describe("partitionAttendance", () => {
  it("groups the roster in its own order, unanswered included", () => {
    const members = [member("u1", "Ana"), member("u2", "Luis"), member("u3", "Rosa")]
    const buckets = partitionAttendance({ u1: "yes", u3: "no" }, members)
    expect(buckets.going.map((m) => m.displayName)).toEqual(["Ana"])
    expect(buckets.maybe).toEqual([])
    expect(buckets.no.map((m) => m.displayName)).toEqual(["Rosa"])
    expect(buckets.unanswered.map((m) => m.displayName)).toEqual(["Luis"])
  })

  it("ignores answers from uids that are no longer in the band", () => {
    const buckets = partitionAttendance({ ghost: "yes" }, [member("u1")])
    expect(buckets.going).toEqual([])
    expect(buckets.unanswered.map((m) => m.uid)).toEqual(["u1"])
  })
})

describe("taskTitle", () => {
  it("trims and bounds", () => {
    expect(taskTitle("  Amp cables  ")).toBe("Amp cables")
    expect(taskTitle("x".repeat(TASK_TITLE_MAX + 20))).toHaveLength(TASK_TITLE_MAX)
    expect(taskTitle("   ")).toBe("")
  })
})

describe("sortTasks", () => {
  it("leads with the pending work and keeps a stable order", () => {
    const tasks = [
      task("c", { done: true, createdAt: stamp(10) }),
      task("b", { createdAt: stamp(30) }),
      task("a", { createdAt: stamp(20) }),
      task("d", { done: true, createdAt: stamp(40) }),
    ]
    expect(sortTasks(tasks).map((entry) => entry.id)).toEqual(["a", "b", "c", "d"])
    // Never mutates the shared input.
    expect(tasks.map((entry) => entry.id)).toEqual(["c", "b", "a", "d"])
  })

  it("breaks ties by id so two devices can never disagree", () => {
    const tasks = [task("b", { createdAt: stamp(5) }), task("a", { createdAt: stamp(5) })]
    expect(sortTasks(tasks).map((entry) => entry.id)).toEqual(["a", "b"])
  })

  it("survives an unmeasured stamp (missing, or a queued local Date)", () => {
    const tasks = [
      task("later", { createdAt: stamp(900) }),
      task("queued", { createdAt: new Date(5000) as never }),
      task("missing", { createdAt: undefined as never }),
    ]
    expect(sortTasks(tasks).map((entry) => entry.id)).toEqual(["missing", "queued", "later"])
  })
})

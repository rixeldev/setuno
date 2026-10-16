import { describe, expect, it } from "vitest"

import {
  CHECKLIST_ITEMS_MAX,
  CHECKLIST_KINDS,
  CHECKLIST_NAME_MAX,
  attachFits,
  attachTaskDocs,
  checklistName,
  normalizeChecklistKind,
  sanitizeChecklistItems,
  sortChecklists,
} from "@/libs/checklistTemplates"
import { MAX_EVENT_TASKS, TASK_TITLE_MAX } from "@/libs/eventLogistics"
import type { ChecklistTemplate } from "@/interfaces"

const stamp = (seconds: number) => ({
  seconds,
  nanoseconds: 0,
  toDate: () => new Date(seconds * 1000),
})

const template = (id: string, over: Partial<ChecklistTemplate> = {}): ChecklistTemplate => ({
  id,
  organizationId: "org-1",
  name: id,
  kind: "gear",
  items: [],
  createdBy: "u1",
  createdAt: stamp(100),
  updatedAt: stamp(100),
  ...over,
})

describe("checklistName", () => {
  it("trims and bounds", () => {
    expect(checklistName("  Full rig  ")).toBe("Full rig")
    expect(checklistName("x".repeat(CHECKLIST_NAME_MAX + 20))).toHaveLength(CHECKLIST_NAME_MAX)
    expect(checklistName("   ")).toBe("")
  })
})

describe("normalizeChecklistKind", () => {
  it("keeps the four kinds and self-heals anything else to custom", () => {
    expect(normalizeChecklistKind("setup")).toBe("setup")
    expect(normalizeChecklistKind("backline")).toBe("custom")
    expect(normalizeChecklistKind(7)).toBe("custom")
    expect(normalizeChecklistKind(undefined)).toBe("custom")
  })
})

describe("sanitizeChecklistItems", () => {
  it("keeps strings only, trimmed, in order", () => {
    expect(sanitizeChecklistItems([" Amps ", "Cables", 42, null])).toEqual(["Amps", "Cables"])
  })

  it("drops empties and exact duplicates", () => {
    expect(sanitizeChecklistItems(["  ", "", "Amps", "Amps", "amps"])).toEqual(["Amps", "amps"])
  })

  it("clamps every title to what a task accepts", () => {
    const [item] = sanitizeChecklistItems(["x".repeat(TASK_TITLE_MAX + 30)])
    expect(item).toHaveLength(TASK_TITLE_MAX)
  })

  it("caps the list at the event's task budget", () => {
    const raw = Array.from({ length: CHECKLIST_ITEMS_MAX + 5 }, (_, index) => `Item ${index}`)
    expect(sanitizeChecklistItems(raw)).toHaveLength(CHECKLIST_ITEMS_MAX)
    expect(CHECKLIST_ITEMS_MAX).toBe(MAX_EVENT_TASKS)
    expect(sanitizeChecklistItems("not a list")).toEqual([])
  })
})

describe("attachFits", () => {
  it("accepts what still fits the event's budget and refuses the rest", () => {
    expect(attachFits(0, CHECKLIST_ITEMS_MAX)).toBe(true)
    expect(attachFits(MAX_EVENT_TASKS - 4, 5)).toBe(false)
    expect(attachFits(MAX_EVENT_TASKS - 5, 5)).toBe(true)
    expect(attachFits(MAX_EVENT_TASKS, 1)).toBe(false)
  })
})

describe("attachTaskDocs", () => {
  it("writes exactly #47's whitelisted shape, unassigned and undone", () => {
    const now = new Date(1000)
    const docs = attachTaskDocs(["Amps", "Cables"], "u1", now)
    expect(docs).toEqual([
      { title: "Amps", assignedTo: "", done: false, createdBy: "u1", createdAt: now, updatedAt: now },
      { title: "Cables", assignedTo: "", done: false, createdBy: "u1", createdAt: now, updatedAt: now },
    ])
    for (const doc of docs) {
      expect(Object.keys(doc).sort()).toEqual(
        ["assignedTo", "createdAt", "createdBy", "done", "title", "updatedAt"],
      )
    }
    expect(attachTaskDocs([], "u1", now)).toEqual([])
  })
})

describe("sortChecklists", () => {
  it("groups by kind in canonical order, then name, then id", () => {
    const lists = [
      template("b", { kind: "gear", name: "Backline" }),
      template("a", { kind: "gear", name: "Amps" }),
      template("p", { kind: "payments", name: "Cash" }),
      template("s", { kind: "setup", name: "Stage" }),
      template("c", { kind: "custom", name: "Misc" }),
    ]
    expect(sortChecklists(lists).map((entry) => entry.id)).toEqual(["a", "b", "s", "p", "c"])
    // Never mutates the shared input.
    expect(lists.map((entry) => entry.id)).toEqual(["b", "a", "p", "s", "c"])
  })

  it("breaks ties by id so two devices can never disagree", () => {
    const lists = [template("b"), template("a")]
    expect(sortChecklists(lists).map((entry) => entry.id)).toEqual(["a", "b"])
  })

  it("lists the kinds in the order the form offers them", () => {
    expect([...CHECKLIST_KINDS]).toEqual(["gear", "setup", "payments", "custom"])
  })
})

import type { ChecklistKind, ChecklistTemplate } from "@/interfaces"
import { MAX_EVENT_TASKS, TASK_TITLE_MAX } from "@/libs/eventLogistics"

/**
 * Reusable checklists (roadmap #49), pure: names, kinds, item lists and the
 * task documents an attach writes. No React, no Firestore — the service maps
 * untrusted documents through these functions, so invalid stored data
 * self-heals on read and the shape the rules pin at list level has a tested
 * twin here (the `markers`/`showLog` precedent exactly).
 */

/** The kinds in their display order; `custom` closes the list. */
export const CHECKLIST_KINDS: readonly ChecklistKind[] = ["gear", "setup", "payments", "custom"]

/** Longest a checklist name may run (the rules pin the same number). */
export const CHECKLIST_NAME_MAX = 80

/**
 * One template holds at most an event's whole task budget (#47's cap), so a
 * checklist always fits an empty event and the attach's headroom check is the
 * only thing that can turn it down.
 */
export const CHECKLIST_ITEMS_MAX = MAX_EVENT_TASKS

/** Trims and bounds a checklist name; empty means "nothing to store". */
export const checklistName = (value: string): string => value.trim().slice(0, CHECKLIST_NAME_MAX)

/** Reads any stored kind back as one of the four — unknown lands on `custom`. */
export const normalizeChecklistKind = (value: unknown): ChecklistKind =>
  typeof value === "string" && (CHECKLIST_KINDS as readonly string[]).includes(value)
    ? (value as ChecklistKind)
    : "custom"

/**
 * A stored (or about-to-be-written) item list: strings only, trimmed, each
 * title clamped to what a task accepts (`TASK_TITLE_MAX` — an attach must
 * never trip the tasks rule), exact duplicates dropped and the list capped.
 * Rules cannot iterate a list, so this is the twin of the shape they pin.
 */
export const sanitizeChecklistItems = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return []
  const items: string[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (typeof entry !== "string") continue
    const title = entry.trim().slice(0, TASK_TITLE_MAX)
    if (title.length === 0 || seen.has(title)) continue
    seen.add(title)
    items.push(title)
  }
  return items.slice(0, CHECKLIST_ITEMS_MAX)
}

/**
 * Whether a template's items still fit beside what the event already carries
 * (#47's `MAX_EVENT_TASKS`); the service turns `false` into its usual error.
 */
export const attachFits = (existingCount: number, itemCount: number): boolean =>
  existingCount + itemCount <= MAX_EVENT_TASKS

/**
 * The task documents an attach writes — **exactly #47's whitelisted shape**
 * (`title`, `assignedTo`, `done`, `createdBy`, `createdAt`, `updatedAt`), so
 * the batch needs no new rules at all. Unassigned and undone by default, one
 * shared client stamp, order preserved.
 */
export const attachTaskDocs = (
  items: readonly string[],
  createdBy: string,
  now: Date,
): {
  title: string
  assignedTo: string
  done: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}[] =>
  items.map((title) => ({
    title,
    assignedTo: "",
    done: false,
    createdBy,
    createdAt: now,
    updatedAt: now,
  }))

/** Kind order first (gear → setup → payments → custom), then name, then id. */
export const sortChecklists = (lists: readonly ChecklistTemplate[]): ChecklistTemplate[] =>
  [...lists].sort((a, b) => {
    const byKind = CHECKLIST_KINDS.indexOf(a.kind) - CHECKLIST_KINDS.indexOf(b.kind)
    if (byKind !== 0) return byKind
    const byName = a.name.localeCompare(b.name)
    if (byName !== 0) return byName
    return a.id.localeCompare(b.id)
  })

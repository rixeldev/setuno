import type { TimestampLike } from "./timestamp"

/**
 * What a reusable checklist is for (roadmap #49). `custom` is the catch-all,
 * and an unrecognised stored kind reads back as it (invalid data self-heals).
 */
export type ChecklistKind = "gear" | "setup" | "payments" | "custom"

/**
 * The kind → i18n key map, declared once for every screen that renders the
 * chips (the `PERFORMANCE_TYPE_KEYS`/`SHOW_OUTCOME_KEYS` precedent).
 */
export const CHECKLIST_KIND_KEYS: Record<ChecklistKind, string> = {
  gear: "checklists.kindGear",
  setup: "checklists.kindSetup",
  payments: "checklists.kindPayments",
  custom: "checklists.kindCustom",
}

/**
 * A band's reusable checklist (roadmap #49): a named list of plain titles
 * (gear, setup, payments, anything custom) that any member stamps onto an
 * event — the attach materialises #47's task documents verbatim, so the event
 * side grows no new shape. Items are plain strings on purpose: their only
 * ids are the form's React keys, never stored, and an edited template never
 * touches the events it already stocked.
 */
export interface ChecklistTemplate {
  id: string
  organizationId: string
  name: string
  kind: ChecklistKind
  /** 1..CHECKLIST_ITEMS_MAX trimmed titles (the rules pin the list's shape). */
  items: string[]
  createdBy: string
  /** Client time (the task/version lesson): order survives an offline create. */
  createdAt: TimestampLike
  updatedAt: TimestampLike
}

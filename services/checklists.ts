import {
  collection,
  deleteDoc,
  doc,
  firestore,
  getDocs,
  limitTo,
  mapDocs,
  onSnapshot,
  paths,
  query,
  requireUserId,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type SubscribeErrorHandler,
  type Unsubscribe,
} from "@/db/Fire"
import type { ChecklistKind, ChecklistTemplate, TimestampLike } from "@/interfaces"
import { ValidationError } from "@/services/errors"
import {
  attachFits,
  attachTaskDocs,
  checklistName,
  normalizeChecklistKind,
  sanitizeChecklistItems,
  sortChecklists,
} from "@/libs/checklistTemplates"
import { MAX_EVENT_TASKS } from "@/libs/eventLogistics"

const checklistCollection = (organizationId: string) =>
  collection(firestore, paths.checklists(organizationId))

const taskCollection = (organizationId: string, performanceId: string) =>
  collection(firestore, paths.performanceTasks(organizationId, performanceId))

const mapChecklist = (data: Record<string, unknown>, id: string): ChecklistTemplate => ({
  id,
  organizationId: String(data.organizationId ?? ""),
  name: checklistName(String(data.name ?? "")),
  kind: normalizeChecklistKind(data.kind),
  items: sanitizeChecklistItems(data.items),
  createdBy: String(data.createdBy ?? ""),
  createdAt: data.createdAt as TimestampLike,
  updatedAt: data.updatedAt as TimestampLike,
})

/** The band's reusable checklists, kind then name (roadmap #49). Live. */
export const subscribeChecklists = (
  organizationId: string | null,
  onChange: (lists: ChecklistTemplate[]) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    checklistCollection(organizationId),
    (snapshot) => onChange(sortChecklists(mapDocs(snapshot, mapChecklist))),
    (error) => onError?.(error),
  )
}

/** One checklist, for the edit form. */
export const subscribeChecklist = (
  organizationId: string | null,
  checklistId: string | null,
  onChange: (list: ChecklistTemplate | null) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId || !checklistId) {
    onChange(null)
    return () => undefined
  }
  return onSnapshot(
    doc(firestore, paths.checklist(organizationId, checklistId)),
    (snapshot) => onChange(snapshot.exists() ? mapChecklist(snapshot.data(), snapshot.id) : null),
    (error) => onError?.(error),
  )
}

/** The shared create/update validation — one place, both writers. */
const normalizeInput = (
  input: { name: string; kind: ChecklistKind; items: string[] },
): { name: string; kind: ChecklistKind; items: string[] } => {
  const name = checklistName(input.name)
  if (name.length === 0) throw new ValidationError("Give the checklist a name.", "name")
  const items = sanitizeChecklistItems(input.items)
  if (items.length === 0) {
    throw new ValidationError("A checklist needs at least one item.", "items")
  }
  return { name, kind: normalizeChecklistKind(input.kind), items }
}

/**
 * Any member maintains the band's checklists — logistics is not an admin job
 * (#47's rule again). Client time on purpose (the task/version lesson).
 */
export const createChecklist = async (
  organizationId: string,
  input: { name: string; kind: ChecklistKind; items: string[] },
): Promise<string> => {
  const uid = requireUserId()
  const normalized = normalizeInput(input)
  const reference = doc(checklistCollection(organizationId))
  const now = new Date()
  await setDoc(reference, {
    organizationId,
    ...normalized,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  })
  return reference.id
}

/** Rewrites the editable fields; `createdBy` and the stamps stay put. */
export const updateChecklist = async (
  organizationId: string,
  checklistId: string,
  input: { name: string; kind: ChecklistKind; items: string[] },
): Promise<void> => {
  const normalized = normalizeInput(input)
  await updateDoc(doc(firestore, paths.checklist(organizationId, checklistId)), {
    ...normalized,
    updatedAt: serverTimestamp(),
  })
}

/** Removes a checklist; the events it already stocked keep their tasks. */
export const deleteChecklist = async (organizationId: string, checklistId: string): Promise<void> => {
  await deleteDoc(doc(firestore, paths.checklist(organizationId, checklistId)))
}

/**
 * Stamps a template onto an event: one task document per item — **exactly
 * #47's whitelisted shape**, so the batch needs no new rules — in a single
 * commit. The event keeps its own life afterwards: editing or deleting the
 * checklist never touches the tasks it already handed out. The headroom check
 * mirrors `createEventTask`'s (`MAX_EVENT_TASKS`).
 */
export const attachChecklistToEvent = async (
  organizationId: string,
  performanceId: string,
  template: ChecklistTemplate,
): Promise<number> => {
  const uid = requireUserId()
  const items = sanitizeChecklistItems(template.items)
  if (items.length === 0) {
    throw new ValidationError("This checklist has no items.", "items")
  }
  const existing = await getDocs(
    query(taskCollection(organizationId, performanceId), limitTo(MAX_EVENT_TASKS + 1)),
  )
  if (!attachFits(existing.size, items.length)) {
    throw new ValidationError("This event already has as many tasks as it can hold.", "items")
  }
  const batch = writeBatch(firestore)
  // Client time, like every other task write (the version-history lesson).
  const now = new Date()
  for (const task of attachTaskDocs(items, uid, now)) {
    batch.set(doc(taskCollection(organizationId, performanceId)), task)
  }
  await batch.commit()
  return items.length
}

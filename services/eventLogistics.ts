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
import type { AttendanceStatus, EventTask } from "@/interfaces"
import { ValidationError } from "@/services/errors"
import { MAX_EVENT_TASKS, sortTasks, taskTitle } from "@/libs/eventLogistics"

const taskCollection = (organizationId: string, performanceId: string) =>
  collection(firestore, paths.performanceTasks(organizationId, performanceId))

const mapTask = (data: Record<string, unknown>, id: string): EventTask => ({
  id,
  title: taskTitle(String(data.title ?? "")),
  assignedTo: String(data.assignedTo ?? ""),
  done: data.done === true,
  createdBy: String(data.createdBy ?? ""),
  createdAt: data.createdAt as EventTask["createdAt"],
  updatedAt: data.updatedAt as EventTask["updatedAt"],
})

/** One event's task list, pending work first (roadmap #47). Live: the detail screen is open while the band ticks things off. */
export const subscribeEventTasks = (
  organizationId: string | null,
  performanceId: string | null,
  onChange: (tasks: EventTask[]) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId || !performanceId) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    taskCollection(organizationId, performanceId),
    (snapshot) => onChange(sortTasks(mapDocs(snapshot, mapTask))),
    (error) => onError?.(error),
  )
}

export const createEventTask = async (
  organizationId: string,
  performanceId: string,
  input: { title: string; assignedTo: string },
): Promise<void> => {
  const uid = requireUserId()
  const title = taskTitle(input.title)
  if (title.length === 0) throw new ValidationError("Give the task a name.", "title")
  const existing = await getDocs(
    query(taskCollection(organizationId, performanceId), limitTo(MAX_EVENT_TASKS + 1)),
  )
  if (existing.size >= MAX_EVENT_TASKS) {
    throw new ValidationError("This event already has as many tasks as it can hold.", "title")
  }
  const reference = doc(taskCollection(organizationId, performanceId))
  // Client time on purpose (the version-history precedent): a server
  // timestamp stays null while the write queues offline, and task order must
  // survive an offline toggle.
  const now = new Date()
  await setDoc(reference, {
    title,
    assignedTo: input.assignedTo.trim(),
    done: false,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  })
}

/** Retitles a task and/or reassigns it (`assignedTo: ""` = anyone's job). */
export const updateEventTask = async (
  organizationId: string,
  performanceId: string,
  taskId: string,
  patch: { title?: string; assignedTo?: string },
): Promise<void> => {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() }
  if (patch.title !== undefined) {
    const title = taskTitle(patch.title)
    if (title.length === 0) throw new ValidationError("Give the task a name.", "title")
    update.title = title
  }
  if (patch.assignedTo !== undefined) update.assignedTo = patch.assignedTo.trim()
  await updateDoc(doc(firestore, paths.performanceTask(organizationId, performanceId, taskId)), update)
}

/** Ticks a task on/off — the checkbox every member may press (roadmap #47). */
export const toggleEventTask = async (
  organizationId: string,
  performanceId: string,
  task: EventTask,
): Promise<void> => {
  await updateDoc(doc(firestore, paths.performanceTask(organizationId, performanceId, task.id)), {
    done: !task.done,
    updatedAt: serverTimestamp(),
  })
}

export const deleteEventTask = async (
  organizationId: string,
  performanceId: string,
  taskId: string,
): Promise<void> => {
  await deleteDoc(doc(firestore, paths.performanceTask(organizationId, performanceId, taskId)))
}

/**
 * The caller's own RSVP for one event (roadmap #47): **one dot-path key**,
 * never the whole map — two members answering at the same time touch
 * different keys and cannot clobber each other, and the rules enforce that
 * a member's write may only ever change their own entry.
 */
export const setAttendance = async (
  organizationId: string,
  performanceId: string,
  status: AttendanceStatus,
): Promise<void> => {
  const uid = requireUserId()
  await updateDoc(doc(firestore, paths.performance(organizationId, performanceId)), {
    [`attendance.${uid}`]: status,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Removes an event's whole task list — the event is going away and Firestore
 * does not cascade subcollections (the `deleteVersions` precedent).
 */
export const deleteEventTasks = async (
  organizationId: string,
  performanceId: string,
): Promise<void> => {
  try {
    const snapshot = await getDocs(
      query(taskCollection(organizationId, performanceId), limitTo(MAX_EVENT_TASKS + 5)),
    )
    if (snapshot.empty) return
    const batch = writeBatch(firestore)
    for (const entry of snapshot.docs) {
      batch.delete(entry.ref)
    }
    await batch.commit()
  } catch {
    // Best-effort cleanup: leftover documents are unreachable either way.
  }
}

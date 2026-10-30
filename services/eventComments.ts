import {
  collection,
  doc,
  firestore,
  getDocs,
  limitTo,
  mapDocs,
  onSnapshot,
  orderBy,
  paths,
  query,
  requireUserId,
  setDoc,
  updateDoc,
  writeBatch,
  type SubscribeErrorHandler,
  type Unsubscribe,
} from "@/db/Fire"
import type { EventComment } from "@/interfaces"
import { logActivity } from "@/services/activity"
import { ValidationError } from "@/services/errors"
import { sanitizeCommentBody } from "@/libs/suggestionComments"

const commentCollection = (organizationId: string, performanceId: string) =>
  collection(firestore, paths.performanceComments(organizationId, performanceId))

const mapComment = (data: Record<string, unknown>, id: string): EventComment => ({
  id,
  body: String(data.body ?? ""),
  authorId: String(data.authorId ?? ""),
  authorName: String(data.authorName ?? ""),
  createdAt: data.createdAt as EventComment["createdAt"],
  deletedAt: (data.deletedAt as EventComment["deletedAt"]) ?? null,
})

/**
 * One event's thread, oldest first (roadmap #90). Live: the event screen is
 * open while the band talks about the night. Reads and writes stay on
 * `isMember` — a guest reads the event but never its conversation (#59).
 */
export const subscribeEventComments = (
  organizationId: string | null,
  performanceId: string | null,
  onChange: (comments: EventComment[]) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId || !performanceId) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    query(commentCollection(organizationId, performanceId), orderBy("createdAt", "asc")),
    (snapshot) => onChange(mapDocs(snapshot, mapComment)),
    (error) => onError?.(error),
  )
}

export const createEventComment = async (
  organizationId: string,
  performanceId: string,
  rawBody: string,
  author: { id: string; name: string },
  eventName = "",
): Promise<void> => {
  const body = sanitizeCommentBody(rawBody)
  if (body === null) throw new ValidationError("Write something first.")
  const uid = requireUserId()
  const reference = doc(commentCollection(organizationId, performanceId))
  // Client time on purpose (the tasks precedent): a server timestamp stays
  // null while the write queues offline and the thread must keep its order.
  await setDoc(reference, {
    body,
    authorId: uid,
    authorName: author.name,
    createdAt: new Date(),
    deletedAt: null,
  })

  void logActivity({
    organizationId,
    type: "performance_commented",
    message: `${author.name} commented on${eventName ? ` "${eventName}"` : " an event"}`,
    actorId: uid,
    actorName: author.name,
    targetType: "performance",
    targetId: performanceId,
  })
}

/**
 * Soft delete: the tombstone keeps the thread's shape for everyone, and it is
 * the only edit the rules ever allow on a comment.
 */
export const deleteEventComment = async (
  organizationId: string,
  performanceId: string,
  commentId: string,
): Promise<void> => {
  // Client time like `createdAt` — never null while an offline write queues.
  await updateDoc(doc(firestore, paths.performanceComment(organizationId, performanceId, commentId)), {
    deletedAt: new Date(),
  })
}

/**
 * The event is going away and Firestore does not cascade subcollections (the
 * `deleteVersions`/`deleteEventTasks` precedent): drop its thread first,
 * bounded to one batch's worth. Documents beyond that would be unreachable
 * either way — the parent id leaves with them.
 */
export const deleteEventComments = async (
  organizationId: string,
  performanceId: string,
): Promise<void> => {
  try {
    const snapshot = await getDocs(
      query(commentCollection(organizationId, performanceId), limitTo(500)),
    )
    if (snapshot.empty) return
    const batch = writeBatch(firestore)
    for (const entry of snapshot.docs) {
      batch.delete(entry.ref)
    }
    await batch.commit()
  } catch {
    // Best-effort cleanup: the parent is deleted regardless.
  }
}

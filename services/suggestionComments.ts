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
import type { SuggestionComment } from "@/interfaces"
import { logActivity } from "@/services/activity"
import { ValidationError } from "@/services/errors"
import { sanitizeCommentBody } from "@/libs/suggestionComments"

const commentCollection = (organizationId: string, suggestionId: string) =>
  collection(firestore, paths.suggestionComments(organizationId, suggestionId))

const mapComment = (data: Record<string, unknown>, id: string): SuggestionComment => ({
  id,
  body: String(data.body ?? ""),
  authorId: String(data.authorId ?? ""),
  authorName: String(data.authorName ?? ""),
  createdAt: data.createdAt as SuggestionComment["createdAt"],
  deletedAt: (data.deletedAt as SuggestionComment["deletedAt"]) ?? null,
})

/** One suggestion's thread, oldest first (roadmap #55). Live: the review screen is open while the band discusses. */
export const subscribeSuggestionComments = (
  organizationId: string | null,
  suggestionId: string | null,
  onChange: (comments: SuggestionComment[]) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId || !suggestionId) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    query(commentCollection(organizationId, suggestionId), orderBy("createdAt", "asc")),
    (snapshot) => onChange(mapDocs(snapshot, mapComment)),
    (error) => onError?.(error),
  )
}

export const createSuggestionComment = async (
  organizationId: string,
  suggestionId: string,
  rawBody: string,
  author: { id: string; name: string },
  songTitle = "",
): Promise<void> => {
  const body = sanitizeCommentBody(rawBody)
  if (body === null) throw new ValidationError("Write something first.")
  const uid = requireUserId()
  const reference = doc(commentCollection(organizationId, suggestionId))
  // Client time on purpose (the tasks precedent): a server timestamp stays
  // null while the write queues offline and the thread must keep its order.
  const now = new Date()
  await setDoc(reference, {
    body,
    authorId: uid,
    authorName: author.name,
    createdAt: now,
    deletedAt: null,
  })

  void logActivity({
    organizationId,
    type: "suggestion_commented",
    message: `${author.name} commented on a suggestion${songTitle ? ` to "${songTitle}"` : ""}`,
    actorId: uid,
    actorName: author.name,
    targetType: "suggestion",
    targetId: suggestionId,
  })
}

/**
 * Soft delete: the tombstone keeps the thread's shape for everyone, and it is
 * the only edit the rules ever allow on a comment.
 */
export const deleteSuggestionComment = async (
  organizationId: string,
  suggestionId: string,
  commentId: string,
): Promise<void> => {
  // Client time like `createdAt` — never null while an offline write queues.
  await updateDoc(
    doc(firestore, paths.suggestionComment(organizationId, suggestionId, commentId)),
    { deletedAt: new Date() },
  )
}

/**
 * The suggestion is going away and Firestore does not cascade subcollections
 * (the `deleteVersions`/`deleteEventTasks` precedent): drop its thread first,
 * bounded to one batch's worth. Documents beyond that would be unreachable
 * either way — the parent id leaves with them.
 */
export const deleteSuggestionComments = async (
  organizationId: string,
  suggestionId: string,
): Promise<void> => {
  try {
    const snapshot = await getDocs(
      query(commentCollection(organizationId, suggestionId), limitTo(500)),
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

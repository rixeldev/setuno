import type { TimestampLike } from "./timestamp"

/**
 * One message in a discussion thread (roadmap #55's suggestion comments,
 * roadmap #90's event comments). Both threads share this shape on purpose: the
 * thread UI (`components/comments/CommentThread.tsx`) is one component, and
 * `firestore.rules` pins the same fields and bounds under each parent.
 *
 * `createdAt` is **client time** so an offline comment keeps its place, and a
 * comment is never edited — only removed, as a tombstone (`deletedAt`) so the
 * thread keeps its shape for everyone.
 */
export interface CommentEntry {
  id: string
  body: string
  authorId: string
  /** Denormalised for display, exactly like a suggestion's own `authorName`. */
  authorName: string
  createdAt: TimestampLike
  /** `null` while live; a timestamp is the tombstone shown to everyone. */
  deletedAt: TimestampLike | null
}

/** A comment on an event (roadmap #90) — the same thread shape as a suggestion's. */
export type EventComment = CommentEntry

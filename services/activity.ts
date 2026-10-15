import {
  collection,
  doc,
  getDoc,
  getDocs,
  limitTo,
  mapDoc,
  mapDocs,
  onSnapshot,
  orderBy,
  paths,
  query,
  serverTimestamp,
  setDoc,
  firestore,
  type SubscribeErrorHandler,
  type Unsubscribe,
} from "@/db/Fire"
import type { ActivityEvent, ActivityType } from "@/interfaces"
import type { TimestampLike } from "@/interfaces/timestamp"
import { toDate } from "@/interfaces/timestamp"
import { createId } from "@/libs/songUtils"

const mapActivity = (data: Record<string, unknown>, id: string): ActivityEvent =>
  ({
    id,
    organizationId: String(data.organizationId ?? ""),
    type: data.type as ActivityType,
    message: String(data.message ?? ""),
    actorId: String(data.actorId ?? ""),
    actorName: String(data.actorName ?? ""),
    targetType: data.targetType as ActivityEvent["targetType"],
    targetId: (data.targetId as string | null) ?? null,
    createdAt: data.createdAt as ActivityEvent["createdAt"],
  }) as ActivityEvent

export interface LogActivityInput {
  organizationId: string
  type: ActivityType
  message: string
  actorId: string
  actorName: string
  targetType: ActivityEvent["targetType"]
  targetId?: string | null
}

/**
 * Appends an entry to the organization activity feed.
 * Fire and forget: activity logging must never block the main operation.
 */
export const logActivity = async (input: LogActivityInput): Promise<void> => {
  try {
    await setDoc(doc(collection(firestore, paths.activity(input.organizationId)), createId("act")), {
      organizationId: input.organizationId,
      type: input.type,
      message: input.message,
      actorId: input.actorId,
      actorName: input.actorName,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      createdAt: serverTimestamp(),
    })
  } catch {
    // Activity is best-effort telemetry; a failure here must not surface.
  }
}

/** Real-time activity feed, newest first. */
export const subscribeActivity = (
  organizationId: string,
  onChange: (events: ActivityEvent[]) => void,
  limit = 30,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId) return () => undefined
  return onSnapshot(
    query(
      collection(firestore, paths.activity(organizationId)),
      orderBy("createdAt", "desc"),
      limitTo(limit),
    ),
    (snapshot) => onChange(mapDocs(snapshot, mapActivity)),
    (error) => onError?.(error),
  )
}

/** One-shot activity read (used by the dashboard). */
export const fetchActivity = async (
  organizationId: string,
  limit = 20,
): Promise<ActivityEvent[]> => {
  const snapshot = await getDocs(
    query(
      collection(firestore, paths.activity(organizationId)),
      orderBy("createdAt", "desc"),
      limitTo(limit),
    ),
  )
  return mapDocs(snapshot, mapActivity)
}

/** Resolves a single activity event (used by deep links from the feed). */
export const fetchActivityEvent = async (
  organizationId: string,
  activityId: string,
): Promise<ActivityEvent | null> => {
  const snapshot = await getDoc(doc(firestore, paths.activityEvent(organizationId, activityId)))
  return mapDoc(snapshot, mapActivity)
}

/**
 * Live personal read marker of the feed for one user and band (roadmap #53):
 * `null` until the user has never marked it, then the instant of the last
 * "mark as read". Private by design — the band never learns who read what.
 */
export const subscribeActivityRead = (
  uid: string,
  organizationId: string,
  onChange: (lastReadAt: Date | null) => void,
): Unsubscribe => {
  if (!uid || !organizationId) return () => undefined
  return onSnapshot(
    doc(firestore, paths.userActivityRead(uid, organizationId)),
    (snapshot) =>
      onChange(mapDoc(snapshot, (data) => toDate(data.lastActivityReadAt as TimestampLike | null))),
    () => onChange(null),
  )
}

/**
 * Stamps the feed as read up to now (roadmap #53). **Client** time, exactly
 * like a trashed song or a version's `savedAt`: a `serverTimestamp` is null
 * while an offline write queues, and a marker that reads "nothing was ever
 * read" would light up every badge until the connection returns. Best-effort
 * like `logActivity` — a rejected marker only keeps the badge lit.
 */
export const markActivityRead = async (
  uid: string,
  organizationId: string,
  at: Date = new Date(),
): Promise<void> => {
  if (!uid || !organizationId) return
  try {
    await setDoc(
      doc(firestore, paths.userActivityRead(uid, organizationId)),
      { lastActivityReadAt: at },
      { merge: true },
    )
  } catch {
    // The badge staying lit is the whole cost of a failed marker.
  }
}
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
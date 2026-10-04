import {
  collection,
  deleteDoc,
  doc,
  firestore,
  getDoc,
  getDocs,
  limitTo,
  mapDoc,
  mapDocs,
  onSnapshot,
  orderBy,
  paths,
  query,
  requireUserId,
  serverTimestamp,
  setDoc,
  updateDoc,
  type SubscribeErrorHandler,
  type Unsubscribe,
} from "@/db/Fire"
import type { Performance, PerformanceInput, PerformanceStatus } from "@/interfaces"
import { logActivity } from "@/services/activity"
import { ValidationError } from "@/services/errors"
import { ISO_DATE_PATTERN, TIME_PATTERN, toIsoDate } from "@/libs/validation"

const mapPerformance = (data: Record<string, unknown>, id: string): Performance => {
  const venue = (data.venue ?? {}) as Record<string, unknown>
  const status = data.status as PerformanceStatus
  return {
    id,
    organizationId: String(data.organizationId ?? ""),
    name: String(data.name ?? ""),
    date: String(data.date ?? ""),
    startTime: String(data.startTime ?? ""),
    endTime: String(data.endTime ?? ""),
    venue: {
      name: String(venue.name ?? ""),
      address: String(venue.address ?? ""),
      notes: String(venue.notes ?? ""),
    },
    notes: String(data.notes ?? ""),
    setlistId: (data.setlistId as string | null) ?? null,
    setlistName: (data.setlistName as string | null) ?? null,
    status: status === "completed" ? "completed" : status === "cancelled" ? "cancelled" : "scheduled",
    createdBy: String(data.createdBy ?? ""),
    createdAt: data.createdAt as Performance["createdAt"],
    updatedAt: data.updatedAt as Performance["updatedAt"],
  }
}

export const subscribePerformances = (
  organizationId: string | null,
  onChange: (performances: Performance[]) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    query(
      collection(firestore, paths.performances(organizationId)),
      orderBy("date", "asc"),
      limitTo(300),
    ),
    (snapshot) => onChange(mapDocs(snapshot, mapPerformance)),
    (error) => onError?.(error),
  )
}

export const fetchPerformances = async (organizationId: string): Promise<Performance[]> => {
  const snapshot = await getDocs(
    query(
      collection(firestore, paths.performances(organizationId)),
      orderBy("date", "asc"),
      limitTo(300),
    ),
  )
  return mapDocs(snapshot, mapPerformance)
}

export const fetchPerformance = async (
  organizationId: string,
  performanceId: string,
): Promise<Performance | null> => {
  const snapshot = await getDoc(doc(firestore, paths.performance(organizationId, performanceId)))
  return mapDoc(snapshot, mapPerformance)
}

const normalizeInput = (input: PerformanceInput): PerformanceInput => {
  const name = input.name.trim()
  if (name.length === 0) throw new ValidationError("Give the performance a name.", "name")
  if (!ISO_DATE_PATTERN.test(input.date)) {
    throw new ValidationError("Pick a valid date for the performance.", "date")
  }
  if (input.startTime.length > 0 && !TIME_PATTERN.test(input.startTime)) {
    throw new ValidationError("Start time must use the HH:mm format.", "startTime")
  }
  if (input.endTime.length > 0 && !TIME_PATTERN.test(input.endTime)) {
    throw new ValidationError("End time must use the HH:mm format.", "endTime")
  }
  if (
    input.startTime.length > 0 &&
    input.endTime.length > 0 &&
    input.endTime <= input.startTime
  ) {
    throw new ValidationError("The end time must be after the start time.", "endTime")
  }

  return {
    name,
    date: input.date,
    startTime: input.startTime.trim(),
    endTime: input.endTime.trim(),
    venue: {
      name: input.venue.name.trim(),
      address: input.venue.address.trim(),
      notes: input.venue.notes.trim(),
    },
    notes: input.notes.trim(),
    setlistId: input.setlistId,
    status: input.status,
  }
}

export const createPerformance = async (
  organizationId: string,
  input: PerformanceInput,
  setlistName: string | null,
  author: { id: string; name: string },
): Promise<string> => {
  const uid = requireUserId()
  const normalized = normalizeInput(input)
  const reference = doc(collection(firestore, paths.performances(organizationId)))
  const now = serverTimestamp()

  await setDoc(reference, {
    ...normalized,
    organizationId,
    setlistName,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  })

  void logActivity({
    organizationId,
    type: "performance_created",
    message: `${author.name} scheduled "${normalized.name}"`,
    actorId: uid,
    actorName: author.name,
    targetType: "performance",
    targetId: reference.id,
  })

  return reference.id
}

export const updatePerformance = async (
  organizationId: string,
  performanceId: string,
  input: PerformanceInput,
  setlistName: string | null,
  actor: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  const normalized = normalizeInput(input)

  await updateDoc(doc(firestore, paths.performance(organizationId, performanceId)), {
    ...normalized,
    setlistName,
    updatedAt: serverTimestamp(),
  })

  void logActivity({
    organizationId,
    type: "performance_updated",
    message: `${actor.name} updated "${normalized.name}"`,
    actorId: uid,
    actorName: actor.name,
    targetType: "performance",
    targetId: performanceId,
  })
}

export const deletePerformance = async (
  organizationId: string,
  performanceId: string,
  actor: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  const performance = await fetchPerformance(organizationId, performanceId)
  await deleteDoc(doc(firestore, paths.performance(organizationId, performanceId)))

  void logActivity({
    organizationId,
    type: "performance_deleted",
    message: `${actor.name} deleted "${performance?.name ?? "a performance"}"`,
    actorId: uid,
    actorName: actor.name,
    targetType: "performance",
    targetId: performanceId,
  })
}

/** Today's date as `yyyy-mm-dd` (used as the default performance date). */
export const todayIsoDate = (): string => toIsoDate(new Date())

/** Splits performances into upcoming and past (docs §16). */
export const partitionPerformances = (
  performances: Performance[],
): { upcoming: Performance[]; past: Performance[] } => {
  const today = todayIsoDate()
  const upcoming: Performance[] = []
  const past: Performance[] = []

  for (const performance of performances) {
    const isUpcoming = performance.date >= today && performance.status !== "cancelled"
    if (isUpcoming) upcoming.push(performance)
    else past.push(performance)
  }

  past.sort((a, b) => b.date.localeCompare(a.date))
  return { upcoming, past }
}

/** The next show, used by the dashboard and the home hero card. */
export const nextPerformance = (performances: Performance[]): Performance | null =>
  partitionPerformances(performances).upcoming[0] ?? null
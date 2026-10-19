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
import type {
  LiveShare,
  Performance,
  PerformanceInput,
  PerformanceStatus,
  ShowLogEntry,
} from "@/interfaces"
import { logActivity } from "@/services/activity"
import { ValidationError } from "@/services/errors"
import { ISO_DATE_PATTERN, TIME_PATTERN, toIsoDate } from "@/libs/validation"
import { orderPerformancesAsc, performanceLastDay } from "@/libs/performances"
import { sanitizeShowLog } from "@/libs/showLog"
import { mapAttendance } from "@/libs/eventLogistics"
import { deleteEventTasks } from "@/services/eventLogistics"

const MAX_SETLISTS = 20

/**
 * Setlists attached to a performance. Documents written before multi-setlist
 * support stored a single `setlistId`/`setlistName` pair: read those too.
 */
const mapSetlists = (data: Record<string, unknown>): Performance["setlists"] => {
  const raw = data.setlists
  if (Array.isArray(raw)) {
    return raw
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      .map((entry) => ({ id: String(entry.id ?? ""), name: String(entry.name ?? "") }))
      .filter((entry) => entry.id.length > 0)
      .slice(0, MAX_SETLISTS)
  }
  if (typeof data.setlistId === "string" && data.setlistId.length > 0) {
    return [{ id: data.setlistId, name: typeof data.setlistName === "string" ? data.setlistName : "" }]
  }
  return []
}

/**
 * The public live setlist pointer (roadmap #57): absent on every older
 * document (reads back as no live link) and malformed entries self-heal to
 * null — the rules pin the shape, this keeps a stray value off the screens.
 */
const mapLiveShare = (value: unknown): LiveShare | null => {
  if (typeof value !== "object" || value === null) return null
  const data = value as Record<string, unknown>
  const token = typeof data.token === "string" ? data.token : ""
  const setlistId = typeof data.setlistId === "string" ? data.setlistId : ""
  return token.length > 0 && setlistId.length > 0 ? { token, setlistId } : null
}

const mapPerformance = (data: Record<string, unknown>, id: string): Performance => {
  const venue = (data.venue ?? {}) as Record<string, unknown>
  const status = data.status as PerformanceStatus
  return {
    id,
    organizationId: String(data.organizationId ?? ""),
    name: String(data.name ?? ""),
    date: String(data.date ?? ""),
    endDate: typeof data.endDate === "string" && data.endDate.length > 0 ? data.endDate : null,
    startTime: String(data.startTime ?? ""),
    endTime: String(data.endTime ?? ""),
    venue: {
      name: String(venue.name ?? ""),
      address: String(venue.address ?? ""),
      notes: String(venue.notes ?? ""),
    },
    notes: String(data.notes ?? ""),
    setlists: mapSetlists(data),
    status: status === "completed" ? "completed" : status === "cancelled" ? "cancelled" : "scheduled",
    // Roadmap #46: absent (or unrecognised) reads back as `gig`, exactly like
    // `status` above — an older document needs no migration.
    type: data.type === "rehearsal" ? "rehearsal" : "gig",
    // Roadmap #45: absent on every older document (reads back as no log), and
    // sanitized on the way in — the rules only pin the list shape.
    showLog: sanitizeShowLog(data.showLog),
    // Roadmap #47: absent on every older document (no answers yet), and only
    // the caller's own key is ever written — the rules enforce exactly that.
    attendance: mapAttendance(data.attendance),
    // Roadmap #57: absent on every older document (no live link), and only
    // written through `setLiveShare` below — never by the event form.
    liveShare: mapLiveShare(data.liveShare),
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
      // Desc, then `orderPerformancesAsc` (P0.9 / #82): the *window* must sit
      // on the newest events — an ascending query + limit would fill it with
      // the band's oldest 300 and every new show would silently stop arriving.
      orderBy("date", "desc"),
      limitTo(300),
    ),
    (snapshot) => onChange(orderPerformancesAsc(mapDocs(snapshot, mapPerformance))),
    (error) => onError?.(error),
  )
}

export const fetchPerformances = async (organizationId: string): Promise<Performance[]> => {
  const snapshot = await getDocs(
    query(
      collection(firestore, paths.performances(organizationId)),
      // Same window rule as the subscription above (P0.9 / #82).
      orderBy("date", "desc"),
      limitTo(300),
    ),
  )
  return orderPerformancesAsc(mapDocs(snapshot, mapPerformance))
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
  const endDate = input.endDate && input.endDate.length > 0 ? input.endDate : null
  if (endDate) {
    if (!ISO_DATE_PATTERN.test(endDate)) {
      throw new ValidationError("Pick a valid end date for the performance.", "endDate")
    }
    if (endDate < input.date) {
      throw new ValidationError("The end date cannot be before the start date.", "endDate")
    }
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
    endDate,
    startTime: input.startTime.trim(),
    endTime: input.endTime.trim(),
    venue: {
      name: input.venue.name.trim(),
      address: input.venue.address.trim(),
      notes: input.venue.notes.trim(),
    },
    notes: input.notes.trim(),
    setlists: input.setlists
      .map((entry) => ({ id: entry.id.trim(), name: entry.name.trim() }))
      .filter((entry) => entry.id.length > 0)
      .filter((entry, index, all) => all.findIndex((other) => other.id === entry.id) === index)
      .slice(0, MAX_SETLISTS),
    status: input.status,
    type: input.type === "rehearsal" ? "rehearsal" : "gig",
  }
}

export const createPerformance = async (
  organizationId: string,
  input: PerformanceInput,
  author: { id: string; name: string },
): Promise<string> => {
  const uid = requireUserId()
  const normalized = normalizeInput(input)
  const reference = doc(collection(firestore, paths.performances(organizationId)))
  const now = serverTimestamp()

  await setDoc(reference, {
    ...normalized,
    organizationId,
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
  actor: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  const normalized = normalizeInput(input)

  await updateDoc(doc(firestore, paths.performance(organizationId, performanceId)), {
    ...normalized,
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

/**
 * Writes an event's show log (roadmap #45) as its own field-level update — the
 * log is deliberately **not** part of `PerformanceInput`, so the event form can
 * never clobber what the show recorded and the log can never rewrite the event.
 * Callers pass the whole array (one entry per song, a few hundred bytes at
 * most): the reader's live sync and the post-gig report both send their full
 * current state, so the last write simply wins — there is no per-entry merge
 * to race. No activity event: marks happen mid-gig and the feed would be spam.
 */
export const saveShowLog = async (
  organizationId: string,
  performanceId: string,
  showLog: readonly ShowLogEntry[],
): Promise<void> => {
  await updateDoc(doc(firestore, paths.performance(organizationId, performanceId)), {
    showLog: sanitizeShowLog(showLog),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Points an event at the share link its fans follow live (roadmap #57), or
 * clears it with `null` — its own field-level update, exactly like
 * `saveShowLog`: `LiveShare` is deliberately **not** part of
 * `PerformanceInput`, so the event form and every status tap leave the link
 * untouched. Turning live off only detaches the event: the share document
 * survives as #56's static snapshot, so the same URL keeps working as the
 * plain setlist it always was.
 */
export const setLiveShare = async (
  organizationId: string,
  performanceId: string,
  liveShare: LiveShare | null,
): Promise<void> => {
  await updateDoc(doc(firestore, paths.performance(organizationId, performanceId)), {
    liveShare,
    updatedAt: serverTimestamp(),
  })
}

export const deletePerformance = async (
  organizationId: string,
  performanceId: string,
  actor: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  const performance = await fetchPerformance(organizationId, performanceId)
  // Firestore does not cascade subcollections: drop the event's tasks first
  // (best-effort inside — leftover docs are unreachable once the event is
  // gone, exactly like the version history's cleanup).
  await deleteEventTasks(organizationId, performanceId)
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

// Pure helpers live in `libs/performances` so unit tests never touch Firestore.
export { performanceDays, performanceLastDay } from "@/libs/performances"

/** Splits performances into upcoming and past (docs §16). */
export const partitionPerformances = (
  performances: Performance[],
): { upcoming: Performance[]; past: Performance[] } => {
  const today = todayIsoDate()
  const upcoming: Performance[] = []
  const past: Performance[] = []

  for (const performance of performances) {
    // A run that started yesterday but ends tomorrow is still upcoming.
    const isUpcoming = performanceLastDay(performance) >= today && performance.status !== "cancelled"
    if (isUpcoming) upcoming.push(performance)
    else past.push(performance)
  }

  past.sort((a, b) => performanceLastDay(b).localeCompare(performanceLastDay(a)))
  return { upcoming, past }
}

/** The next show, used by the dashboard and the home hero card. */
export const nextPerformance = (performances: Performance[]): Performance | null =>
  partitionPerformances(performances).upcoming[0] ?? null
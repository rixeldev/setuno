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
import type { DatePoll, DatePollOption, PollVote, TimestampLike } from "@/interfaces"
import { ValidationError } from "@/services/errors"
import {
  POLL_OPTION_MAX,
  POLL_OPTION_MIN,
  POLL_TITLE_MAX,
  cleanVoteIds,
  mapPollOptions,
  pollTitle,
  sortPollOptions,
  sortPolls,
} from "@/libs/datePolls"

const pollCollection = (organizationId: string) =>
  collection(firestore, paths.datePolls(organizationId))

const voteCollection = (organizationId: string, pollId: string) =>
  collection(firestore, paths.datePollVotes(organizationId, pollId))

const mapPoll = (data: Record<string, unknown>, id: string): DatePoll => ({
  id,
  organizationId: String(data.organizationId ?? ""),
  title: pollTitle(String(data.title ?? "")),
  options: mapPollOptions(data.options),
  status: data.status === "closed" ? "closed" : "open",
  winningOptionId: String(data.winningOptionId ?? ""),
  createdEventId: String(data.createdEventId ?? ""),
  createdBy: String(data.createdBy ?? ""),
  createdAt: data.createdAt as TimestampLike,
  updatedAt: data.updatedAt as TimestampLike,
})

const mapVote = (data: Record<string, unknown>, id: string): PollVote => ({
  uid: id,
  optionIds: cleanVoteIds(data.optionIds),
  updatedAt: data.updatedAt as TimestampLike,
})

/** The band's polls, open ones first (roadmap #48). Live: the list screen is open while votes land. */
export const subscribePolls = (
  organizationId: string | null,
  onChange: (polls: DatePoll[]) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    pollCollection(organizationId),
    (snapshot) => onChange(sortPolls(mapDocs(snapshot, mapPoll))),
    (error) => onError?.(error),
  )
}

/** One poll, for the detail screen. */
export const subscribePoll = (
  organizationId: string | null,
  pollId: string | null,
  onChange: (poll: DatePoll | null) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId || !pollId) {
    onChange(null)
    return () => undefined
  }
  return onSnapshot(
    doc(firestore, paths.datePoll(organizationId, pollId)),
    (snapshot) => onChange(snapshot.exists() ? mapPoll(snapshot.data(), snapshot.id) : null),
    (error) => onError?.(error),
  )
}

/** Every member's availability under one poll (doc id = uid). */
export const subscribePollVotes = (
  organizationId: string | null,
  pollId: string | null,
  onChange: (votes: PollVote[]) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId || !pollId) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    voteCollection(organizationId, pollId),
    (snapshot) => onChange(mapDocs(snapshot, mapVote)),
    (error) => onError?.(error),
  )
}

/**
 * Any member may propose dates — logistics, not an admin job (#47's own
 * rule) — and the poll is born open with no winner. Options are sanitized
 * here exactly like the rules' document-level shape (the rules cannot
 * iterate the list).
 */
export const createPoll = async (
  organizationId: string,
  input: { title: string; options: DatePollOption[] },
): Promise<string> => {
  const uid = requireUserId()
  const title = pollTitle(input.title)
  if (title.length === 0) throw new ValidationError("Give the poll a name.", "title")
  if (title.length > POLL_TITLE_MAX) {
    throw new ValidationError("That poll name is too long.", "title")
  }
  const options = sortPollOptions(mapPollOptions(input.options))
  if (options.length < POLL_OPTION_MIN) {
    throw new ValidationError("A poll needs at least two dates.", "options")
  }
  if (options.length > POLL_OPTION_MAX) {
    throw new ValidationError("That is all the dates a poll can hold.", "options")
  }
  const reference = doc(pollCollection(organizationId))
  // Client time on purpose (the task/version precedent): the list orders
  // itself newest-first and must survive an offline create.
  const now = new Date()
  await setDoc(reference, {
    organizationId,
    title,
    options,
    status: "open",
    winningOptionId: "",
    createdEventId: "",
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  })
  return reference.id
}

/**
 * The caller's own availability: **their document alone** (doc id = uid),
 * the whole list rewritten each time — no array union, so two devices
 * voting for the same member cannot clobber each other (the favorites
 * toggle's contract verbatim).
 */
export const saveMyVote = async (
  organizationId: string,
  pollId: string,
  optionIds: string[],
): Promise<void> => {
  const uid = requireUserId()
  await setDoc(doc(firestore, paths.datePollVote(organizationId, pollId, uid)), {
    optionIds: cleanVoteIds(optionIds),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Closes the poll on its winner (admin — the rules pin it: closing is what
 * turns the poll into an event). `winnerOptionId` is "" when nobody voted,
 * and the winner maths lives in `libs/datePolls.ts#pollWinner`, never here.
 */
export const closePoll = async (
  organizationId: string,
  pollId: string,
  winnerOptionId: string,
): Promise<void> => {
  await updateDoc(doc(firestore, paths.datePoll(organizationId, pollId)), {
    status: "closed",
    winningOptionId: winnerOptionId,
    updatedAt: serverTimestamp(),
  })
}

/** Records the event created from the winner, so nobody creates it twice. */
export const markPollEventCreated = async (
  organizationId: string,
  pollId: string,
  eventId: string,
): Promise<void> => {
  await updateDoc(doc(firestore, paths.datePoll(organizationId, pollId)), {
    createdEventId: eventId,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Removes a poll and its votes — Firestore does not cascade subcollections
 * (the `deleteEventTasks` precedent): the votes go first, best-effort, and
 * an orphaned vote is unreachable either way.
 */
export const deletePoll = async (organizationId: string, pollId: string): Promise<void> => {
  try {
    const snapshot = await getDocs(query(voteCollection(organizationId, pollId), limitTo(200)))
    if (!snapshot.empty) {
      const batch = writeBatch(firestore)
      for (const entry of snapshot.docs) {
        batch.delete(entry.ref)
      }
      await batch.commit()
    }
  } catch {
    // Best-effort cleanup: leftover documents are unreachable once the poll
    // is gone, exactly like the version history's cleanup.
  }
  await deleteDoc(doc(firestore, paths.datePoll(organizationId, pollId)))
}

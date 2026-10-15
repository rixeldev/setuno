import type { ActivityEvent } from "@/interfaces"
import { toDate } from "@/interfaces/timestamp"

/**
 * Unread activity (roadmap #53): the marker is one timestamp per user per
 * band — "everything up to here was read" — and the count is derived from the
 * feed the app already subscribes to, so no new document is written per
 * event. An event with no comparable timestamp (a `serverTimestamp` renders
 * as null while its write is still queued offline) counts as **read**: it is
 * your own action on your own screen, and a phantom badge would only flicker.
 */
export const isUnreadActivity = (event: ActivityEvent, lastReadAt: Date | null): boolean => {
  const at = toDate(event.createdAt)
  if (!at) return false
  return !lastReadAt || at.getTime() > lastReadAt.getTime()
}

/** How many events in the subscribed feed window are newer than the marker. */
export const countUnreadActivity = (
  events: readonly ActivityEvent[],
  lastReadAt: Date | null,
): number => {
  let count = 0
  for (const event of events) if (isUnreadActivity(event, lastReadAt)) count += 1
  return count
}

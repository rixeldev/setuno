import type { Performance, Setlist } from "@/interfaces"
import { performanceLastDay } from "@/libs/performances"

export interface SetlistNavigation {
  /** Previous song in the running order, or null at the start. */
  previousId: string | null
  /** Next song in the running order, or null at the end. */
  nextId: string | null
  setlistId: string
  eventId: string
}

interface Candidate {
  setlist: Setlist
  event: Performance
  upcoming: boolean
}

/**
 * Navigation between the songs of a setlist that belongs to an event.
 *
 * Only event setlists qualify ("a list of an event"): a song that lives solely
 * in an unattached draft returns null. When the song is in several event lists,
 * the nearest upcoming event wins; otherwise the most recent one. Cancelled
 * events never count.
 */
export const findSetlistNavigation = (
  songId: string,
  setlists: Setlist[],
  performances: Performance[],
  todayIso: string,
): SetlistNavigation | null => {
  const candidates: Candidate[] = setlists
    .filter((setlist) => setlist.songs.some((entry) => entry.songId === songId))
    .map((setlist) => {
      const events = performances
        .filter(
          (performance) =>
            performance.status !== "cancelled" &&
            performance.setlists.some((reference) => reference.id === setlist.id),
        )
        .sort((a, b) => a.date.localeCompare(b.date))
      const upcoming = events.find((event) => performanceLastDay(event) >= todayIso) ?? null
      const past = [...events].reverse().find((event) => performanceLastDay(event) < todayIso) ?? null
      const event = upcoming ?? past
      return event ? { setlist, event, upcoming: upcoming !== null } : null
    })
    .filter((entry) => entry !== null)

  const chosen = candidates.sort((a, b) => {
    if (a.upcoming !== b.upcoming) return a.upcoming ? -1 : 1
    return a.upcoming
      ? a.event.date.localeCompare(b.event.date)
      : b.event.date.localeCompare(a.event.date)
  })[0]
  if (!chosen) return null

  const ids = chosen.setlist.songs.map((entry) => entry.songId)
  const index = ids.indexOf(songId)
  if (index < 0) return null

  return {
    previousId: index > 0 ? ids[index - 1] : null,
    nextId: index < ids.length - 1 ? ids[index + 1] : null,
    setlistId: chosen.setlist.id,
    eventId: chosen.event.id,
  }
}

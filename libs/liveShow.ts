import type { SetlistWithSongs } from "@/interfaces"

/**
 * Pure helpers for the live show panel (roadmap #7). The reader can be opened
 * from an event's setlist, so while the band plays it shows where they are, how
 * long they have been going, what comes next and a break countdown. Nothing here
 * touches Firebase — the show clock lives in `hooks/useReaderSession.ts`, in
 * memory only, and the shared documents are never written.
 */

export interface LiveSetEntry {
  songId: string
  title: string
  /** Song length in seconds, or null when unknown. */
  durationSec: number | null
}

/** Running order of a setlist enriched with each song's known duration. */
export const liveSetEntries = (
  setlist: Pick<SetlistWithSongs, "songs"> & { resolvedSongs?: SetlistWithSongs["resolvedSongs"] },
): LiveSetEntry[] =>
  setlist.songs.map((entry) => ({
    songId: entry.songId,
    title: entry.title,
    durationSec: setlist.resolvedSongs?.find((song) => song.id === entry.songId)?.durationSec ?? null,
  }))

/** Total known duration of every song in the running order, in seconds. */
export const liveTotalSec = (entries: readonly LiveSetEntry[]): number =>
  entries.reduce((sum, entry) => sum + (entry.durationSec ?? 0), 0)

/** Seconds of music still to be played after the current song. */
export const remainingSec = (entries: readonly LiveSetEntry[], index: number): number =>
  entries.slice(index + 1).reduce((sum, entry) => sum + (entry.durationSec ?? 0), 0)

/**
 * Elapsed time against the estimate: positive means the band is running long.
 * Null when the estimate is unknown, so the UI hides the delta.
 */
export const scheduleDeltaSec = (elapsedSec: number, estimatedSec: number): number | null =>
  estimatedSec > 0 ? Math.round(elapsedSec - estimatedSec) : null

/** Seconds left on a break, clamped at zero (null until means "no break"). */
export const breakRemainingSec = (until: number | null, now: number): number =>
  until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000))

/** Clock label for a number of seconds: "4:07", "1:02:33". */
export const formatClock = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes)
  return `${hours > 0 ? `${hours}:` : ""}${mm}:${String(secs).padStart(2, "0")}`
}

/** 0..1 progress across the running order, for the song-position bar. */
export const liveProgressRatio = (index: number, total: number): number => {
  if (total <= 0) return 0
  return Math.min(1, Math.max(0, (index + 1) / total))
}

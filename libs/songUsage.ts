import type { Performance } from "@/interfaces/performance"
import type { Setlist } from "@/interfaces/setlist"
import { performanceLastDay } from "@/libs/performances"

/**
 * Usage history (roadmap #34): "played N times, last played X events ago"
 * derived from the performances and setlists the band already has. Nothing is
 * ever stored — a new schema would only duplicate what these two collections
 * already say, and it would drift the moment an event was deleted.
 */

/** How far back the "not played recently" filter reaches. */
export const NOT_RECENT_DAYS = 180

/** The two usage chips in the songbook's filter dialog (roadmap #34). */
export type SongUsageFilter = "never" | "notRecent"

/** Every value the app can offer, in dialog order — sanitizing checks against this. */
export const SONG_USAGE_FILTERS: readonly SongUsageFilter[] = ["never", "notRecent"]

/**
 * A song's derived usage. An entry exists **only for songs that have been
 * played**, so "never played" is simply the absence of one and needs no
 * zero-count bookkeeping.
 */
export interface SongUsage {
  /** Completed events whose setlists include the song — once per event, even when it appears in two lists of the same show. */
  timesPlayed: number
  /** ISO date (`yyyy-mm-dd`) of the most recent completed event that included it. */
  lastPlayedOn: string
  /** Completed events that happened after that one (`0` = the latest event). */
  eventsAgo: number
}

/**
 * Counts a song as played when a **completed** event's setlist contains it.
 * Scheduled events are promises (nobody has played them yet) and cancelled
 * events never happened — only `completed` says the band actually played the
 * song, and the event detail screen offers admins exactly that action.
 *
 * Events are ordered newest first by their last day (the same ordering
 * `partitionPerformances` uses for past shows), ties broken by id so the same
 * data always derives the same numbers.
 */
export const buildSongUsage = (
  performances: Performance[],
  setlists: Setlist[],
): Map<string, SongUsage> => {
  const setlistsById = new Map(setlists.map((setlist) => [setlist.id, setlist]))
  const completed = performances
    .filter((performance) => performance.status === "completed")
    .sort(
      (a, b) =>
        performanceLastDay(b).localeCompare(performanceLastDay(a)) || a.id.localeCompare(b.id),
    )

  const usage = new Map<string, SongUsage>()
  completed.forEach((performance, eventsAgo) => {
    // One pass per event: a song played in two of its lists was still played
    // once at that event, and the first sighting in this newest-first walk is
    // by definition the *last* time the band played it.
    const playedHere = new Set<string>()
    for (const reference of performance.setlists) {
      const setlist = setlistsById.get(reference.id)
      if (!setlist) continue
      for (const entry of setlist.songs) {
        if (playedHere.has(entry.songId)) continue
        playedHere.add(entry.songId)
        const existing = usage.get(entry.songId)
        if (existing) existing.timesPlayed += 1
        else usage.set(entry.songId, { timesPlayed: 1, lastPlayedOn: performance.date, eventsAgo })
      }
    }
  })

  return usage
}

/** Local `yyyy-mm-dd`, matching how events store their dates. */
const todayIso = (): string => {
  const now = new Date()
  const month = `${now.getMonth() + 1}`.padStart(2, "0")
  const day = `${now.getDate()}`.padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Calendar days from `earlier` to `later`: both parse as UTC midnight (the
 * date-only form of `Date.parse`), so the difference is always a whole number
 * of days no matter which timezone the app runs in.
 */
const daysBetween = (earlier: string, later: string): number =>
  Math.round((Date.parse(later) - Date.parse(earlier)) / 86_400_000)

/**
 * The ids passing the usage filter — the set `filterSongs` keeps (the same
 * shape as the favorites set from #33), built once per render from the song
 * list and the derived map.
 *
 * `"notRecent"` deliberately needs a real play beyond `NOT_RECENT_DAYS`:
 * never-played songs belong to the `"never"` chip, and without this rule they
 * would appear under both. The boundary itself (`exactly NOT_RECENT_DAYS`
 * days ago) still counts as recent.
 */
export const usagePassIds = (
  songs: readonly { id: string }[],
  filter: SongUsageFilter,
  usage: ReadonlyMap<string, SongUsage>,
  today: string = todayIso(),
): Set<string> => {
  const passing = new Set<string>()
  for (const song of songs) {
    const entry = usage.get(song.id)
    if (filter === "never") {
      if (entry === undefined) passing.add(song.id)
    } else if (entry && daysBetween(entry.lastPlayedOn, today) > NOT_RECENT_DAYS) {
      passing.add(song.id)
    }
  }
  return passing
}

/** How many completed events a song must have missed before the picker offers
 * it again (roadmap #44). The roadmap's own example is "not played in 3 gigs". */
export const ROTATION_MISSED_EVENTS = 3
/** How many suggestions the setlist picker shows at once. */
export const ROTATION_SUGGESTION_LIMIT = 3

/** A picker suggestion: the song, and how many events it missed (`null`: never played). */
export interface RotationSuggestion<T extends { id: string; title: string }> {
  song: T
  eventsAgo: number | null
}

/**
 * Rotation candidates for a setlist (roadmap #44), derived from the same usage
 * map the songbook's filters read — nothing is stored, and a deleted event
 * cannot leave a stale suggestion behind.
 *
 * A song qualifies when it missed at least `ROTATION_MISSED_EVENTS` completed
 * events, or was never played at all. The ranking is **most neglected first**:
 * played songs come out by how many events they missed (most first), ties
 * broken by fewer total plays and then title, with never-played songs *last* —
 * reviving known material beats debuting untested songs in a running order,
 * and the row's caption ("Never played" / "last played 5 events ago") always
 * says which kind each row is.
 *
 * The caller passes the pool it is already showing (the picker's own
 * candidates), so the retired filter and the "already in this list" exclusion
 * are respected without re-deriving them here.
 */
export const rotationSuggestions = <T extends { id: string; title: string }>(
  songs: readonly T[],
  usage: ReadonlyMap<string, SongUsage>,
  options: { limit?: number } = {},
): RotationSuggestion<T>[] => {
  const limit = Math.max(0, Math.round(options.limit ?? ROTATION_SUGGESTION_LIMIT))
  const ranked: RotationSuggestion<T>[] = []
  for (const song of songs) {
    const entry = usage.get(song.id)
    if (entry && entry.eventsAgo < ROTATION_MISSED_EVENTS) continue
    ranked.push({ song, eventsAgo: entry ? entry.eventsAgo : null })
  }
  ranked.sort((a, b) => {
    // Never-played songs rank *after* every played one (they are the least
    // urgent rotation: no history to revive), then by distance — most
    // neglected first — then by fewer total plays, then title, then id, so
    // the same data always produces the same list on every device.
    const aPlayed = a.eventsAgo !== null
    const bPlayed = b.eventsAgo !== null
    if (aPlayed !== bPlayed) return aPlayed ? -1 : 1
    if (a.eventsAgo !== b.eventsAgo) return (b.eventsAgo ?? 0) - (a.eventsAgo ?? 0)
    const aPlays = usage.get(a.song.id)?.timesPlayed ?? 0
    const bPlays = usage.get(b.song.id)?.timesPlayed ?? 0
    if (aPlays !== bPlays) return aPlays - bPlays
    return a.song.title.localeCompare(b.song.title) || a.song.id.localeCompare(b.song.id)
  })
  return ranked.slice(0, limit)
}

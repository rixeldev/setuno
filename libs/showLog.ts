import type { ShowLogEntry, ShowOutcome } from "@/interfaces/performance"

/**
 * The show log (roadmap #45): what happened to each song while the band ran
 * an event's setlist from the reader, plus how long each one actually took.
 *
 * Pure and synchronous, like every other derived helper in `libs/`. Two
 * writers feed it and neither re-derives the other's maths:
 *
 * - the **live session** (`hooks/useReaderSession.ts`) records song visits and
 *   outcome marks while the show runs, with `useShowLogSync` persisting the
 *   array on every change;
 * - the **post-gig report** (`components/performances/ShowReport.tsx`) writes
 *   marks and notes after the fact through `services/performances.ts#
 *   saveShowLog`.
 *
 * Firestore rules cannot iterate a list, so the document-level shape (a list,
 * at most `MAX_SHOW_LOG_ENTRIES` entries) is pinned in `firestore.rules` and
 * every entry is sanitized here on read and write — the annotations' `markers`
 * precedent exactly.
 */

/** Every outcome the app can offer, in picker order. */
export const SHOW_OUTCOMES: readonly ShowOutcome[] = ["played", "skipped", "improvised"]

/** Mirrors the `size() <= …` cap in `firestore.rules`. */
export const MAX_SHOW_LOG_ENTRIES = 500

/** Notes stay short captions, not essays (and mirror the rules' doc budget). */
export const SHOW_NOTE_MAX = 300

/** A song cannot take a day; anything longer is garbage, not a measurement. */
const MAX_SONG_SEC = 86_400

/**
 * One break window of the live show (roadmap #45). Break time never lands on
 * a song's clock, so the report compares *playing* time with the estimate.
 *
 * `until` is the scheduled end; `end` is when the band actually dismissed the
 * break (null while it is still open). The effective end is
 * `min(end ?? now, until)`: a dismissed-early break counts as it really was,
 * and one nobody dismissed is assumed over when its countdown was.
 */
export interface ShowBreakWindow {
  start: number
  until: number
  end: number | null
}

/**
 * Rebuilds a log from untrusted data (Firestore, an old cache, a queued
 * write). Malformed entries are dropped, an unrecognised outcome reads back
 * as `played` — exactly #30's self-heal: a mark nobody understands must not
 * silently become "skipped" and lose the song from history — and repeated
 * songs keep the **last** entry, matching who wrote the array.
 */
export const sanitizeShowLog = (raw: unknown): ShowLogEntry[] => {
  if (!Array.isArray(raw)) return []
  const entries: ShowLogEntry[] = []
  const slotBySong = new Map<string, number>()
  for (const value of raw) {
    if (typeof value !== "object" || value === null) continue
    const data = value as Record<string, unknown>
    const songId = typeof data.songId === "string" ? data.songId.trim() : ""
    if (!songId) continue
    const outcome = SHOW_OUTCOMES.includes(data.outcome as ShowOutcome)
      ? (data.outcome as ShowOutcome)
      : "played"
    const rawSec = typeof data.actualSec === "number" && Number.isFinite(data.actualSec) ? data.actualSec : 0
    const actualSec = Math.min(MAX_SONG_SEC, Math.max(0, Math.round(rawSec)))
    const entry: ShowLogEntry = {
      songId,
      outcome,
      actualSec,
      note: typeof data.note === "string" ? data.note.trim().slice(0, SHOW_NOTE_MAX) : "",
      updatedAt:
        typeof data.updatedAt === "number" && Number.isFinite(data.updatedAt) ? data.updatedAt : 0,
    }
    const slot = slotBySong.get(songId)
    if (slot === undefined) {
      slotBySong.set(songId, entries.length)
      entries.push(entry)
    } else {
      entries[slot] = entry
    }
  }
  return entries.slice(0, MAX_SHOW_LOG_ENTRIES)
}

/** The log's entry for one song, or null when the song was never logged. */
export const showEntryFor = (
  log: readonly ShowLogEntry[],
  songId: string,
): ShowLogEntry | null => log.find((entry) => entry.songId === songId) ?? null

/** Replaces (or appends) one song's entry, never mutating the given array. */
export const upsertShowEntry = (
  log: readonly ShowLogEntry[],
  entry: ShowLogEntry,
): ShowLogEntry[] => {
  const index = log.findIndex((item) => item.songId === entry.songId)
  if (index === -1) return [...log, entry]
  return log.map((item, slot) => (slot === index ? entry : item))
}

/**
 * Makes sure a song has an entry, without touching one that already exists —
 * the reader calls this when the band *arrives* at a song, so merely opening
 * it registers "played" (the mark sheet corrects it) while an earlier mark or
 * note survives.
 */
export const ensureShowEntry = (
  log: readonly ShowLogEntry[],
  songId: string,
  now: number,
): ShowLogEntry[] => {
  if (showEntryFor(log, songId)) return [...log]
  return [...log, { songId, outcome: "played", actualSec: 0, note: "", updatedAt: now }]
}

/**
 * Adds measured seconds to a song's entry (created when missing), preserving
 * the outcome and note already recorded — visits accumulate, so a song the
 * band came back to keeps both plays.
 */
export const recordVisitSeconds = (
  log: readonly ShowLogEntry[],
  songId: string,
  seconds: number,
  now: number,
): ShowLogEntry[] => {
  const existing = showEntryFor(log, songId)
  return upsertShowEntry(log, {
    songId,
    outcome: existing?.outcome ?? "played",
    actualSec: Math.max(0, Math.round((existing?.actualSec ?? 0) + seconds)),
    note: existing?.note ?? "",
    updatedAt: now,
  })
}

/** Marks a song's outcome, preserving its measured time and note. */
export const markShowOutcome = (
  log: readonly ShowLogEntry[],
  songId: string,
  outcome: ShowOutcome,
  now: number,
): ShowLogEntry[] => {
  const existing = showEntryFor(log, songId)
  return upsertShowEntry(log, {
    songId,
    outcome,
    actualSec: existing?.actualSec ?? 0,
    note: existing?.note ?? "",
    updatedAt: now,
  })
}

/**
 * Sets a song's note, preserving its outcome and measured time. Editing a
 * song that was never logged creates its entry with the conservative
 * outcome: unlogged means "played", exactly like `sanitizeShowLog`.
 */
export const replaceShowNote = (
  log: readonly ShowLogEntry[],
  songId: string,
  note: string,
  now: number,
): ShowLogEntry[] => {
  const existing = showEntryFor(log, songId)
  return upsertShowEntry(log, {
    songId,
    outcome: existing?.outcome ?? "played",
    actualSec: existing?.actualSec ?? 0,
    note: note.trim().slice(0, SHOW_NOTE_MAX),
    updatedAt: now,
  })
}

/**
 * The songs an event's log says were **skipped** — the seam both #34 (song
 * usage) and #35 (the year recap) read through: a skipped song was in a
 * setlist but was not played, so it neither counts as a play nor stamps a
 * "last played" date. `improvised` counts as played, and no log at all (every
 * show before this feature) keeps the previous behaviour.
 */
export const skippedSongIds = (log: readonly ShowLogEntry[]): Set<string> => {
  const skipped = new Set<string>()
  for (const entry of log) if (entry.outcome === "skipped") skipped.add(entry.songId)
  return skipped
}

/**
 * Seconds a song was really on the clock between `enteredAt` and `leftAt`,
 * with every break overlap taken out (a break paused the whole show, so its
 * minutes must not inflate whichever song happened to be on screen).
 */
export const visitSeconds = (
  enteredAt: number,
  leftAt: number,
  breaks: readonly ShowBreakWindow[],
): number => {
  const span = Math.max(0, leftAt - enteredAt)
  let paused = 0
  for (const window of breaks) {
    const start = Math.max(window.start, enteredAt)
    const stop = Math.min(window.end === null ? leftAt : window.end, window.until, leftAt)
    if (stop > start) paused += stop - start
  }
  return Math.max(0, Math.round((span - paused) / 1000))
}

/** One row of the post-gig report: the song, both clocks and the mark. */
export interface ShowReportRow {
  songId: string
  title: string
  /** Estimated length in seconds, or null when nobody knows it. */
  estimatedSec: number | null
  /** Measured seconds while the show ran, or null when the song has no entry. */
  actualSec: number | null
  /** `actualSec - estimatedSec` when both are known, else null. */
  deltaSec: number | null
  /** The entry behind the numbers (mark, measured time, note). */
  entry: ShowLogEntry | null
}

/** One section of the report — each attached setlist renders its own group. */
export interface ShowReportGroup {
  id: string
  name: string
  rows: ShowReportRow[]
}

export interface ShowReportTotals {
  /** Rows on screen (songs counted once, even when a list repeats one). */
  rows: number
  /** Songs carrying any entry at all. */
  logged: number
  played: number
  skipped: number
  improvised: number
  /** Sums over the rows that have each clock; never a lying zero. */
  estimatedSec: number
  actualSec: number
}

export interface ShowReport {
  groups: ShowReportGroup[]
  totals: ShowReportTotals
}

/**
 * Builds the report the post-gig screen renders (roadmap #45): one group per
 * setlist, the running order preserved, and the whole log projected onto it —
 * a song in two of the event's lists keeps its **first** row (it was one
 * song, played once, with one clock), and a logged song no list contains
 * anymore shows in an extra group the caller passes in, so nothing the band
 * recorded can disappear from the review.
 */
export const buildShowReport = (
  groups: readonly {
    id: string
    name: string
    songs: readonly { songId: string; title: string }[]
  }[],
  durationFor: (songId: string) => number | null,
  log: readonly ShowLogEntry[],
): ShowReport => {
  const totals: ShowReportTotals = {
    rows: 0,
    logged: 0,
    played: 0,
    skipped: 0,
    improvised: 0,
    estimatedSec: 0,
    actualSec: 0,
  }
  const seen = new Set<string>()
  const built: ShowReportGroup[] = []
  for (const group of groups) {
    const rows: ShowReportRow[] = []
    for (const song of group.songs) {
      if (seen.has(song.songId)) continue
      seen.add(song.songId)
      const entry = showEntryFor(log, song.songId)
      const estimatedSec = durationFor(song.songId)
      const actualSec = entry ? entry.actualSec : null
      rows.push({
        songId: song.songId,
        title: song.title,
        estimatedSec,
        actualSec,
        deltaSec:
          estimatedSec !== null && actualSec !== null ? actualSec - estimatedSec : null,
        entry,
      })
      totals.rows += 1
      if (entry) {
        totals.logged += 1
        if (entry.outcome === "skipped") totals.skipped += 1
        else if (entry.outcome === "improvised") totals.improvised += 1
        else totals.played += 1
      }
      if (estimatedSec !== null) totals.estimatedSec += estimatedSec
      if (actualSec !== null) totals.actualSec += actualSec
    }
    built.push({ id: group.id, name: group.name, rows })
  }
  return { groups: built, totals }
}

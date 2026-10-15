import type { OrganizationMember } from "@/interfaces/organization"
import type { Performance } from "@/interfaces/performance"
import type { Setlist } from "@/interfaces/setlist"
import type { Song } from "@/interfaces/song"
import { toDate } from "@/interfaces/timestamp"
import { buildSongUsage } from "@/libs/songUsage"

/**
 * Band stats and the year-in-review card (roadmap #35): every number here is
 * derived from the performances, setlists and songs the band already has —
 * nothing is stored, exactly like #34's usage history, so the stats can never
 * drift behind an edit or a deleted event.
 */

/** One song in the "top songs" ranking — also the card's most-played line. */
export interface TopSong {
  id: string
  title: string
  artist: string
  /** Completed events whose setlists include it (once per event, #34's rule). */
  timesPlayed: number
}

/** What one member has contributed, counted from the documents' authorship. */
export interface MemberActivity {
  uid: string
  displayName: string
  photoURL: string | null
  songs: number
  setlists: number
  events: number
  /** Songs + setlists + events — what the ordering is by. */
  total: number
}

export interface BandStats {
  /** Completed events: the shows that actually happened. */
  showsPlayed: number
  /** Distinct songs the band has played at least once. */
  songsPlayed: number
  /** Minutes of music performed across those shows (known durations only). */
  musicMinutes: number
  /** Every played song, most played first, ties broken by title. */
  topSongs: TopSong[]
  /**
   * Mean duration of the band's measurable lists — real running orders (not
   * templates) with songs and a known total — or `null` when nothing can be
   * measured: a band whose songs carry no durations reads "—", never "0 min".
   */
  averageSetMinutes: number | null
  /** How many lists the average is taken over (its "across N setlists" hint). */
  setlistsAveraged: number
  /** Current members, biggest contributor first; zeros stay at the bottom. */
  memberActivity: MemberActivity[]
}

export interface YearRecap {
  year: number
  /** Completed events whose first day falls in `year`. */
  shows: number
  /** Distinct songs played at those shows. */
  songsPlayed: number
  /** Minutes of music at those shows (known durations only). */
  minutes: number
  /** Songs created in `year` (documents whose stamp resolves to it). */
  newSongs: number
  /** Most played song of the year, ties broken by title; `null` when idle. */
  topSong: TopSong | null
}

/** Tallies one uid per sighting. */
const countBy = (uids: Iterable<string>): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const uid of uids) counts.set(uid, (counts.get(uid) ?? 0) + 1)
  return counts
}

/**
 * Sums each attached setlist's stored duration across `completed` events —
 * once per event (two lists of one show add up, the same list attached twice
 * to one show was still played once) but once per show again, because the
 * same setlist played at two shows was performed twice.
 */
const performedSeconds = (completed: Performance[], byId: Map<string, Setlist>): number => {
  let seconds = 0
  for (const performance of completed) {
    const seen = new Set<string>()
    for (const reference of performance.setlists) {
      if (seen.has(reference.id)) continue
      seen.add(reference.id)
      seconds += byId.get(reference.id)?.estimatedDurationSec ?? 0
    }
  }
  return seconds
}

/**
 * The stats screen's three derived groups (roadmap #35): top songs (through
 * #34's `buildSongUsage`, so the reader footer, the usage filter and this
 * ranking can never disagree), the average set length, and what each member
 * has authored — songs, setlists and events counted from the documents
 * themselves, so a removed member keeps no row but a quiet one keeps a zero.
 */
export const buildBandStats = (
  performances: Performance[],
  setlists: Setlist[],
  songs: Song[],
  members: OrganizationMember[],
): BandStats => {
  const setlistById = new Map(setlists.map((list) => [list.id, list]))
  const songById = new Map(songs.map((song) => [song.id, song]))
  const completed = performances.filter((performance) => performance.status === "completed")

  const usage = buildSongUsage(performances, setlists)
  const topSongs: TopSong[] = []
  for (const [songId, entry] of usage) {
    const song = songById.get(songId)
    // A song that left the library (trashed, merged away) is not a ranking row.
    if (song) {
      topSongs.push({
        id: songId,
        title: song.title,
        artist: song.artist,
        timesPlayed: entry.timesPlayed,
      })
    }
  }
  topSongs.sort((a, b) => b.timesPlayed - a.timesPlayed || a.title.localeCompare(b.title))

  const measured = setlists.filter(
    (list) => !list.template && list.songs.length > 0 && list.estimatedDurationSec > 0,
  )
  const measuredSeconds = measured.reduce((total, list) => total + list.estimatedDurationSec, 0)

  const songCounts = countBy(songs.map((song) => song.createdBy))
  const setlistCounts = countBy(setlists.map((list) => list.createdBy))
  const eventCounts = countBy(performances.map((performance) => performance.createdBy))
  const memberActivity: MemberActivity[] = members
    .map((member) => {
      const songCount = songCounts.get(member.uid) ?? 0
      const setlistCount = setlistCounts.get(member.uid) ?? 0
      const eventCount = eventCounts.get(member.uid) ?? 0
      return {
        uid: member.uid,
        displayName: member.displayName,
        photoURL: member.photoURL,
        songs: songCount,
        setlists: setlistCount,
        events: eventCount,
        total: songCount + setlistCount + eventCount,
      }
    })
    .sort((a, b) => b.total - a.total || a.displayName.localeCompare(b.displayName))

  return {
    showsPlayed: completed.length,
    songsPlayed: usage.size,
    musicMinutes: Math.round(performedSeconds(completed, setlistById) / 60),
    topSongs,
    averageSetMinutes:
      measured.length > 0 ? Math.round(measuredSeconds / measured.length / 60) : null,
    setlistsAveraged: measured.length,
    memberActivity,
  }
}

/**
 * One calendar year's recap for the shareable card. A show belongs to the
 * year it **started** in (`yyyy-mm-dd` prefix match): a run crossing New
 * Year's Eve is that year's show, not both years'. Scheduled events are
 * promises and cancelled ones never happened, so only `completed` counts —
 * the same rule #34 builds usage with.
 */
export const buildYearRecap = (
  performances: Performance[],
  setlists: Setlist[],
  songs: Song[],
  year: number,
): YearRecap => {
  const setlistById = new Map(setlists.map((list) => [list.id, list]))
  const songById = new Map(songs.map((song) => [song.id, song]))
  const prefix = `${year}-`
  const played = performances.filter(
    (performance) => performance.status === "completed" && performance.date.startsWith(prefix),
  )

  const playCounts = new Map<string, number>()
  let musicSeconds = 0
  for (const performance of played) {
    const seenLists = new Set<string>()
    const seenSongs = new Set<string>()
    for (const reference of performance.setlists) {
      if (!seenLists.has(reference.id)) {
        seenLists.add(reference.id)
        musicSeconds += setlistById.get(reference.id)?.estimatedDurationSec ?? 0
      }
      const list = setlistById.get(reference.id)
      if (!list) continue
      // One sighting per song per show: a song in two lists of the same night
      // was played once, mirroring `buildSongUsage`.
      for (const entry of list.songs) {
        if (seenSongs.has(entry.songId)) continue
        seenSongs.add(entry.songId)
        playCounts.set(entry.songId, (playCounts.get(entry.songId) ?? 0) + 1)
      }
    }
  }

  let topSong: TopSong | null = null
  for (const [songId, timesPlayed] of playCounts) {
    const song = songById.get(songId)
    if (!song) continue
    if (
      topSong === null ||
      timesPlayed > topSong.timesPlayed ||
      (timesPlayed === topSong.timesPlayed && song.title.localeCompare(topSong.title) < 0)
    ) {
      topSong = { id: songId, title: song.title, artist: song.artist, timesPlayed }
    }
  }

  let newSongs = 0
  for (const song of songs) {
    const created = toDate(song.createdAt)
    if (created && created.getFullYear() === year) newSongs += 1
  }

  return {
    year,
    shows: played.length,
    songsPlayed: playCounts.size,
    minutes: Math.round(musicSeconds / 60),
    newSongs,
    topSong,
  }
}

/**
 * Years the recap picker can offer: every year an event is dated in (future
 * plans included — a band may want to look ahead) plus every year a song was
 * created in, always with the current year in the list. Newest first.
 */
export const recapYears = (
  performances: Performance[],
  songs: Song[],
  now: Date = new Date(),
): number[] => {
  const years = new Set<number>([now.getFullYear()])
  for (const performance of performances) {
    const year = Number(performance.date.slice(0, 4))
    if (Number.isInteger(year) && year > 0) years.add(year)
  }
  for (const song of songs) {
    const created = toDate(song.createdAt)
    if (created) years.add(created.getFullYear())
  }
  return [...years].sort((a, b) => b - a)
}

/**
 * The year the screen opens on: the most recent one that actually holds
 * content (a completed show or a song written), so January does not greet an
 * empty current-year card while last year's recap sits one tap away. Future
 * years are skipped — a booked gig is a plan, not a recap — and a band with
 * nothing yet falls back to the current year.
 */
export const defaultRecapYear = (
  performances: Performance[],
  setlists: Setlist[],
  songs: Song[],
  now: Date = new Date(),
): number => {
  const current = now.getFullYear()
  for (const year of recapYears(performances, songs, now)) {
    if (year > current) continue
    const recap = buildYearRecap(performances, setlists, songs, year)
    if (recap.shows > 0 || recap.newSongs > 0) return year
  }
  return current
}

/**
 * A filesystem-safe name for the shared PNG: accent-stripped, lowercased
 * slug of the band name (`"Ñandú Groove"` → `nandu-groove`), falling back to
 * "band" so an empty or symbol-only name still yields a valid file.
 */
export const recapFileName = (bandName: string, year: number): string => {
  const slug = bandName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `setuno-${slug || "band"}-${year}.png`
}

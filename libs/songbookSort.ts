import type { Song } from "@/interfaces/song"
import { toMillis } from "@/interfaces/timestamp"
import { songDurationSec } from "@/libs/songSearch"

/**
 * Orders the songbook (roadmap #37). Pure and synchronous: the whole library is
 * already in memory, so sorting is an array walk on every keystroke, exactly
 * like `filterSongs` next door.
 */
export type SongSort = "title" | "titleDesc" | "artist" | "added" | "tempo" | "length"

/** Every order, in the sequence the sort picker offers them. */
export const SONG_SORTS: SongSort[] = ["title", "titleDesc", "artist", "added", "tempo", "length"]

/**
 * Before anyone picks an order the songbook reads A→Z by title, which is what
 * the `orderBy("title")` query already applies. The comparison is a locale one,
 * so mixed-case and accented titles collate the way a person reads them rather
 * than by code point — the one deliberate difference from the query, since a
 * "Title (A→Z)" option that put "Zebra" above "apple" would look broken.
 */
export const DEFAULT_SORT: SongSort = "title"

type Comparator = (first: Song, second: Song) => number

/** Ties always fall back to the title, so the same list can never shuffle. */
const byTitle: Comparator = (first, second) => first.title.localeCompare(second.title)

/** An unmeasured tempo or length means "unknown", which sorts last, never first. */
const UNMEASURED = Number.MAX_SAFE_INTEGER

const tempoOf = (song: Song): number => (song.bpm && song.bpm > 0 ? song.bpm : UNMEASURED)

const lengthOf = (song: Song): number => songDurationSec(song) ?? UNMEASURED

/** Newest first; a song with no timestamp is not "new", so it sinks. */
const ageOf = (song: Song): number => toMillis(song.createdAt) ?? 0

const COMPARATORS: Record<SongSort, Comparator> = {
  title: byTitle,
  titleDesc: (first, second) => second.title.localeCompare(first.title),
  artist: (first, second) => {
    // Songs nobody is credited to pile up at the top of an alphabetical listing
    // otherwise, hiding above A behind an empty row.
    const creditedFirst = first.artist.trim() ? 0 : 1
    const creditedSecond = second.artist.trim() ? 0 : 1
    if (creditedFirst !== creditedSecond) return creditedFirst - creditedSecond
    return first.artist.localeCompare(second.artist) || byTitle(first, second)
  },
  added: (first, second) => ageOf(second) - ageOf(first) || byTitle(first, second),
  tempo: (first, second) => tempoOf(first) - tempoOf(second) || byTitle(first, second),
  length: (first, second) => lengthOf(first) - lengthOf(second) || byTitle(first, second),
}

/**
 * Returns the songs in `order` — a **new** array, never the caller's. The list
 * handed down from the listener is shared, so sorting it in place would rewrite
 * what every other consumer of the library sees.
 */
export const sortSongs = (songs: Song[], order: SongSort): Song[] => {
  const comparator = COMPARATORS[order] ?? COMPARATORS[DEFAULT_SORT]
  return [...songs].sort(comparator)
}

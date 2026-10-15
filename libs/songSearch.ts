import type { ChordPosition, Song } from "@/interfaces/song"
import { estimateDurationSec } from "@/libs/songUtils"

/** Tempo buckets offered by the advanced search (roadmap #36). */
export type BpmBucket = "slow" | "medium" | "fast" | "sprint"

/** Length buckets offered by the advanced search (roadmap #36). */
export type DurationBucket = "short" | "standard" | "long"

export interface SongFilters {
  /** Free text across title, artist, genre and tags. */
  search: string
  artist: string | null
  genre: string | null
  key: string | null
  tag: string | null
  /** Chord progression such as `C G Am F`, matched one lyric line at a time. */
  progression: string
  bpm: BpmBucket | null
  duration: DurationBucket | null
  /** Only this user's starred songs (roadmap #33) — personal, never band data. */
  favoritesOnly: boolean
}

export const EMPTY_FILTERS: SongFilters = {
  search: "",
  artist: null,
  genre: null,
  key: null,
  tag: null,
  progression: "",
  bpm: null,
  duration: null,
  favoritesOnly: false,
}

/** Tempo buckets in ascending order; the filter dialog renders them in turn. */
export const BPM_BUCKETS: BpmBucket[] = ["slow", "medium", "fast", "sprint"]

/** Length buckets in ascending order; the filter dialog renders them in turn. */
export const DURATION_BUCKETS: DurationBucket[] = ["short", "standard", "long"]

interface Range {
  min: number
  /** `null` means unbounded above. */
  max: number | null
}

/** Seconds and BPM are stored exactly as written, so the buckets are inclusive. */
const BPM_RANGES: Record<BpmBucket, Range> = {
  slow: { min: 0, max: 89 },
  medium: { min: 90, max: 119 },
  fast: { min: 120, max: 159 },
  sprint: { min: 160, max: null },
}

const DURATION_RANGES: Record<DurationBucket, Range> = {
  short: { min: 0, max: 179 },
  standard: { min: 180, max: 299 },
  long: { min: 300, max: null },
}

const inRange = (value: number | null, range: Range): boolean =>
  value !== null && value >= range.min && (range.max === null || value <= range.max)

/**
 * The length the songbook shows for a song: its own duration when set, or the
 * lyric-length estimate `SongRow` falls back to. `null` when there is nothing
 * to measure at all, so a duration filter never matches a silent, empty song.
 */
export const songDurationSec = (song: Song): number | null => {
  if (song.durationSec !== null && song.durationSec > 0) return song.durationSec
  const estimate = estimateDurationSec(song.sections)
  return estimate > 0 ? estimate : null
}

const normalize = (value: string): string => value.toLowerCase().trim()

/** The chords of one line, in playing order, lowercased and trimmed. */
const chordTokens = (chords: ChordPosition[]): string[] =>
  [...chords]
    .sort((first, second) => first.position - second.position)
    .map((chord) => chord.chord.trim().toLowerCase())
    .filter((chord) => chord.length > 0)

/**
 * Every lyric line's chord sequence, in order (roadmap #36). Progressions are
 * matched per line, so `Am F C G` finds a song that plays those four chords in
 * a row on one line even when the rest of the song differs.
 */
export const songChordLines = (song: Song): string[][] =>
  song.sections.flatMap((section) => section.lines.map((line) => chordTokens(line.chords)))

/**
 * Chord progression split into lowercased tokens: `C G Am F`, `C, G, Am, F`
 * and `c|g|am|f` all read the same. Slashes are kept (`G/B` is one chord).
 */
export const progressionTokens = (value: string): string[] =>
  value
    .split(/[\s,;|]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0)

/** True when `line` contains `progression` as a contiguous run of chords. */
const lineHasProgression = (line: string[], progression: string[]): boolean => {
  for (let start = 0; start + progression.length <= line.length; start += 1) {
    if (progression.every((chord, offset) => line[start + offset] === chord)) return true
  }
  return false
}

/** True when at least one chip facet is active (ignores the text boxes). */
export const hasFacetFilters = (filters: SongFilters): boolean =>
  filters.artist !== null ||
  filters.genre !== null ||
  filters.key !== null ||
  filters.tag !== null ||
  filters.bpm !== null ||
  filters.duration !== null

/** Any narrowing at all: the search box, the chord progression and the star facet count too. */
export const isFiltered = (filters: SongFilters): boolean =>
  normalize(filters.search).length > 0 ||
  progressionTokens(filters.progression).length > 0 ||
  filters.favoritesOnly ||
  hasFacetFilters(filters)

/**
 * Instant, in-memory search + filtering. Songs live in a small collection that
 * is already cached by the real-time listener, so this stays responsive even
 * for large songbooks (docs §33, §34).
 *
 * The in-memory limits, measured rather than guessed — per keystroke:
 *
 * - **Facets** (artist, genre, key, tag, tempo bucket, length bucket) are one
 *   field test per song: O(n), and they never touch a lyric. Even 5 000 songs
 *   cost well under a millisecond.
 * - **Free text** scans a short haystack per song (title/artist/genre/tags/key)
 *   and stays a few milliseconds at 5 000 songs.
 * - **Chord progression** is the only part that reads lyrics, and it is
 *   `songs × lines × chords`. `songChordLines` materialises every line of a
 *   song before the match, so it pays the full cost whether or not the song
 *   matches. On desktop-class V8 that is ~8 ms for a 300-song band book (40
 *   lyric lines each), ~27 ms at 1 000 songs, and ~0.5 s at 5 000 very dense
 *   songs. A phone is a few times slower, so assume ~30 ms for the realistic
 *   case above.
 *
 * The binding limit is therefore the songbook Firestore keeps subscribed in
 * memory, not this function: a band keeps a few hundred songs, which is
 * comfortably interactive, and nothing here ever touches the network. Past a
 * few thousand songs the progression walk is the first thing to feel sluggish,
 * and the fix is a chord index computed once per snapshot from `songChordLines`
 * rather than per keystroke — no songbook has needed it yet.
 *
 * `favorites` (roadmap #33) is the acting user's starred ids and only matters
 * when `filters.favoritesOnly` is set: the filter stays pure over songs, the
 * personal set rides along as context — and with the flag on but no set given,
 * everything is excluded rather than let through.
 */
export const filterSongs = (
  songs: Song[],
  filters: SongFilters,
  favorites?: ReadonlySet<string>,
): Song[] => {
  const term = normalize(filters.search)
  const terms = term.length > 0 ? term.split(/\s+/) : []
  const progression = progressionTokens(filters.progression)

  const filtered = songs.filter((song) => {
    if (filters.favoritesOnly && !favorites?.has(song.id)) return false
    if (filters.artist !== null && song.artist !== filters.artist) return false
    if (filters.genre !== null && song.genre !== filters.genre) return false
    if (filters.key !== null && song.key !== filters.key) return false
    if (filters.tag !== null && !song.tags.includes(filters.tag)) return false
    if (filters.bpm !== null && !inRange(song.bpm, BPM_RANGES[filters.bpm])) return false
    if (
      filters.duration !== null &&
      !inRange(songDurationSec(song), DURATION_RANGES[filters.duration])
    ) {
      return false
    }
    if (
      progression.length > 0 &&
      !songChordLines(song).some((line) => lineHasProgression(line, progression))
    ) {
      return false
    }

    if (terms.length === 0) return true
    const haystack = normalize(
      [song.title, song.artist, song.genre, song.tags.join(" "), song.key].join(" "),
    )
    return terms.every((part) => haystack.includes(part))
  })

  return filtered
}

/**
 * Text normalised for duplicate matching: lowercased, trimmed and with every
 * run of whitespace (including non-breaking spaces) collapsed to one space, so
 * `"  Wonder  Wall "` and `"wonder wall"` are the same title.
 */
export const normalizeSongText = (value: string): string =>
  value.toLowerCase().replace(/[\s\u00a0]+/g, " ").trim()

export interface SongDuplicate {
  song: Song
  /** True when the artist matches too, not only the title. */
  sameArtist: boolean
}

/**
 * Songs that already look like the one about to be created (roadmap #39).
 *
 * The title must match exactly (normalised); the artist narrows it down: when
 * both the draft and the stored song credit somebody, a different artist means
 * a different song and is left alone — otherwise the rows are candidates, with
 * the same-artist ones first. An empty draft title never matches.
 */
export const findDuplicateSongs = (
  songs: Song[],
  draft: { title: string; artist?: string },
): SongDuplicate[] => {
  const title = normalizeSongText(draft.title)
  if (title.length === 0) return []

  const artist = normalizeSongText(draft.artist ?? "")
  const matches: SongDuplicate[] = []
  for (const song of songs) {
    if (normalizeSongText(song.title) !== title) continue
    const songArtist = normalizeSongText(song.artist)
    if (artist.length > 0 && songArtist.length > 0 && songArtist !== artist) continue
    matches.push({ song, sameArtist: artist.length > 0 && songArtist === artist })
  }

  return matches.sort((a, b) => Number(b.sameArtist) - Number(a.sameArtist))
}

/** Distinct facet values derived from the current library. */
export const songFacets = (songs: Song[]): {
  artists: string[]
  genres: string[]
  keys: string[]
  tags: string[]
} => {
  const artists = new Set<string>()
  const genres = new Set<string>()
  const keys = new Set<string>()
  const tags = new Set<string>()

  for (const song of songs) {
    if (song.artist.trim().length > 0) artists.add(song.artist)
    if (song.genre.trim().length > 0) genres.add(song.genre)
    if (song.key.trim().length > 0) keys.add(song.key)
    for (const tag of song.tags) tags.add(tag)
  }

  const sort = (values: Set<string>): string[] => Array.from(values).sort((a, b) => a.localeCompare(b))
  return { artists: sort(artists), genres: sort(genres), keys: sort(keys), tags: sort(tags) }
}

/**
 * How many filter chips light up the toolbar badge. The free-text search box
 * stays out of it (it is always visible), while the chord progression counts —
 * it lives inside the filter dialog, so the badge has to say it is set.
 */
export const countActiveFilters = (filters: SongFilters): number =>
  [filters.artist, filters.genre, filters.key, filters.tag, filters.bpm, filters.duration].filter(
    (value) => value !== null,
  ).length +
  (progressionTokens(filters.progression).length > 0 ? 1 : 0) +
  (filters.favoritesOnly ? 1 : 0)

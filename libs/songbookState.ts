import { BPM_BUCKETS, DURATION_BUCKETS, EMPTY_FILTERS, type BpmBucket, type DurationBucket, type SongFilters } from "@/libs/songSearch"
import { DEFAULT_SORT, SONG_SORTS, type SongSort } from "@/libs/songbookSort"

/**
 * What the songbook remembers between visits (roadmap #37): the filters that
 * were on and the order that was chosen. Everything is local — a band's library
 * is private to the app either way, and this must work offline like the rest of
 * the reader settings.
 *
 * The plain shape and its sanitizer live here, away from `AsyncStorage`, so the
 * recovery rules are unit-tested: whatever comes back out of storage after a
 * downgrade, a corruption or a half-written value has to produce a songbook
 * that opens, not one that throws.
 */
export interface SongbookState {
  filters: SongFilters
  sort: SongSort
}

export const EMPTY_SONGBOOK: SongbookState = {
  filters: EMPTY_FILTERS,
  sort: DEFAULT_SORT,
}

/** One band's entry, as it sits under the current user's identity. */
export const songbookKey = (organizationId: string | null | undefined, uid: string | null | undefined): string =>
  `${organizationId ?? ""}/${uid ?? ""}`

/** A facet is either a real value or nothing at all — never an empty string. */
const facet = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null)

const bucket = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null

/**
 * Rebuilds a saved state from untrusted JSON. Unknown fields are dropped and
 * anything out of range falls back to the default, so a filter bucket that a
 * newer version removed cannot leave the list permanently empty and a sort the
 * app no longer offers cannot disable sorting.
 */
export const sanitizeSongbook = (raw: unknown): SongbookState => {
  if (raw === null || typeof raw !== "object") return EMPTY_SONGBOOK
  const source = raw as Record<string, unknown>
  const stored = source.filters
  const filters: Record<string, unknown> =
    stored !== null && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {}

  const rebuilt: SongFilters = {
    ...EMPTY_FILTERS,
    search: typeof filters.search === "string" ? filters.search : "",
    artist: facet(filters.artist),
    genre: facet(filters.genre),
    key: facet(filters.key),
    tag: facet(filters.tag),
    progression: typeof filters.progression === "string" ? filters.progression : "",
    bpm: bucket<BpmBucket>(filters.bpm, BPM_BUCKETS),
    duration: bucket<DurationBucket>(filters.duration, DURATION_BUCKETS),
  }

  return { filters: rebuilt, sort: bucket<SongSort>(source.sort, SONG_SORTS) ?? DEFAULT_SORT }
}

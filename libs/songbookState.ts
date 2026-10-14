import { BPM_BUCKETS, DURATION_BUCKETS, EMPTY_FILTERS, type BpmBucket, type DurationBucket, type SongFilters } from "@/libs/songSearch"
import { DEFAULT_SORT, SONG_SORTS, type SongSort } from "@/libs/songbookSort"

/**
 * What the songbook remembers between visits (roadmap #37): the filters that
 * were on, the order that was chosen, and — since part B — the views the reader
 * named along the way. Everything is local — a band's library is private to the
 * app either way, and this must work offline like the rest of the reader
 * settings.
 *
 * The plain shapes and their sanitizers live here, away from `AsyncStorage`, so
 * the recovery rules are unit-tested: whatever comes back out of storage after
 * a downgrade, a corruption or a half-written value has to produce a songbook
 * that opens, not one that throws.
 */
export interface SongbookState {
  filters: SongFilters
  sort: SongSort
  views: SongbookView[]
}

/**
 * A named saved view (roadmap #37 part B): one filters-and-order pair the
 * reader can jump back to — "Sunday acoustic", "slow songs in G". It is stored
 * beside the live state rather than in it, so applying a view is the same kind
 * of local write as moving a facet.
 */
export interface SongbookView {
  id: string
  name: string
  filters: SongFilters
  sort: SongSort
}

/**
 * How many views one band/user entry may hold. Bounded so a corrupted cache
 * cannot grow the document without limit, and small enough that the picker
 * stays a short list.
 */
export const MAX_SONGBOOK_VIEWS = 20

export const EMPTY_SONGBOOK: SongbookState = {
  filters: EMPTY_FILTERS,
  sort: DEFAULT_SORT,
  views: [],
}

/** One band's entry, as it sits under the current user's identity. */
export const songbookKey = (organizationId: string | null | undefined, uid: string | null | undefined): string =>
  `${organizationId ?? ""}/${uid ?? ""}`

/** A facet is either a real value or nothing at all — never an empty string. */
const facet = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null)

const bucket = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null

/**
 * Rebuilds filters from untrusted JSON. Unknown fields are dropped and anything
 * out of range falls back to empty, so a filter bucket that a newer version
 * removed cannot leave the list permanently empty. Shared by the live state and
 * by every stored view, which means a view can never smuggle in a filter the
 * app no longer offers.
 */
export const sanitizeFilters = (raw: unknown): SongFilters => {
  const stored = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}

  return {
    ...EMPTY_FILTERS,
    search: typeof stored.search === "string" ? stored.search : "",
    artist: facet(stored.artist),
    genre: facet(stored.genre),
    key: facet(stored.key),
    tag: facet(stored.tag),
    progression: typeof stored.progression === "string" ? stored.progression : "",
    bpm: bucket<BpmBucket>(stored.bpm, BPM_BUCKETS),
    duration: bucket<DurationBucket>(stored.duration, DURATION_BUCKETS),
  }
}

/** Sorts are an enum, so an unknown one simply means "the default order". */
const sanitizeSort = (raw: unknown): SongSort => bucket<SongSort>(raw, SONG_SORTS) ?? DEFAULT_SORT

/**
 * First free `vN` id. Deterministic — ids never depend on randomness, so the
 * same list always yields the same next id and a test can pin it.
 */
export const nextSongbookViewId = (views: readonly SongbookView[]): string => {
  const taken = new Set(views.map((view) => view.id))
  let next = 1
  while (taken.has(`v${next}`)) next += 1
  return `v${next}`
}

/**
 * Saves a view. A name that already exists (trimmed, case-insensitively) is
 * replaced **in place** — same id, same position — so re-saving under a name is
 * how you update a view instead of accumulating near-duplicates. A genuinely
 * new name is appended, and the list is capped by dropping the **oldest**, at
 * the front: entries are appended, so the tail is always the newest.
 */
export const upsertSongbookView = (
  views: readonly SongbookView[],
  view: SongbookView,
): SongbookView[] => {
  const saved: SongbookView = { ...view, name: view.name.trim() }
  const at = views.findIndex(
    (candidate) => candidate.name.trim().toLowerCase() === saved.name.toLowerCase(),
  )
  const next =
    at >= 0
      ? views.map((candidate, index) => (index === at ? { ...saved, id: candidate.id } : candidate))
      : [...views, saved]
  const overflow = next.length - MAX_SONGBOOK_VIEWS
  return overflow > 0 ? next.slice(overflow) : next
}

/** Drops one view by id; an unknown id leaves the list untouched. */
export const removeSongbookView = (views: readonly SongbookView[], id: string): SongbookView[] =>
  views.filter((view) => view.id !== id)

/**
 * Rebuilds the stored views from untrusted JSON. Entries without a usable name
 * are dropped, ids are de-duplicated (a repeated id would make "delete this
 * one" ambiguous, so the second one is renumbered), every filters/sort pair is
 * re-sanitized, and the list is capped at `MAX_SONGBOOK_VIEWS`.
 */
export const sanitizeSongbookViews = (raw: unknown): SongbookView[] => {
  if (!Array.isArray(raw)) return []

  const views: SongbookView[] = []
  const ids = new Set<string>()
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const source = item as Record<string, unknown>
    const name = typeof source.name === "string" ? source.name.trim() : ""
    if (!name) continue

    let id = typeof source.id === "string" ? source.id.trim() : ""
    if (!id || ids.has(id)) id = nextSongbookViewId(views)
    ids.add(id)

    views.push({ id, name, filters: sanitizeFilters(source.filters), sort: sanitizeSort(source.sort) })
    if (views.length >= MAX_SONGBOOK_VIEWS) break
  }
  return views
}

/**
 * Rebuilds a saved state from untrusted JSON. Unknown fields are dropped and
 * anything out of range falls back to the default, so a filter bucket that a
 * newer version removed cannot leave the list permanently empty and a sort the
 * app no longer offers cannot disable sorting.
 */
export const sanitizeSongbook = (raw: unknown): SongbookState => {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_SONGBOOK
  const source = raw as Record<string, unknown>

  return {
    filters: sanitizeFilters(source.filters),
    sort: sanitizeSort(source.sort),
    views: sanitizeSongbookViews(source.views),
  }
}

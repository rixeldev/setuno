import type { Song } from "@/interfaces/song"

export interface SongFilters {
  /** Free text across title, artist, genre and tags. */
  search: string
  artist: string | null
  genre: string | null
  key: string | null
  tag: string | null
}

export const EMPTY_FILTERS: SongFilters = {
  search: "",
  artist: null,
  genre: null,
  key: null,
  tag: null,
}

const normalize = (value: string): string => value.toLowerCase().trim()

/** True when at least one facet filter is active (ignores the search box). */
export const hasFacetFilters = (filters: SongFilters): boolean =>
  filters.artist !== null || filters.genre !== null || filters.key !== null || filters.tag !== null

export const isFiltered = (filters: SongFilters): boolean =>
  normalize(filters.search).length > 0 || hasFacetFilters(filters)

/**
 * Instant, in-memory search + filtering. Songs live in a small collection that
 * is already cached by the real-time listener, so this stays responsive even
 * for large songbooks (docs §33, §34).
 */
export const filterSongs = (songs: Song[], filters: SongFilters): Song[] => {
  const term = normalize(filters.search)
  const terms = term.length > 0 ? term.split(/\s+/) : []

  const filtered = songs.filter((song) => {
    if (filters.artist !== null && song.artist !== filters.artist) return false
    if (filters.genre !== null && song.genre !== filters.genre) return false
    if (filters.key !== null && song.key !== filters.key) return false
    if (filters.tag !== null && !song.tags.includes(filters.tag)) return false

    if (terms.length === 0) return true
    const haystack = normalize(
      [song.title, song.artist, song.genre, song.tags.join(" "), song.key].join(" "),
    )
    return terms.every((part) => haystack.includes(part))
  })

  return filtered
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

export const countActiveFilters = (filters: SongFilters): number =>
  [filters.artist, filters.genre, filters.key, filters.tag].filter((value) => value !== null).length
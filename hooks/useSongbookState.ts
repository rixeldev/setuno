import { useEffect, useState } from "react"

import type { SongFilters } from "@/libs/songSearch"
import type { SongSort } from "@/libs/songbookSort"
import { EMPTY_SONGBOOK, songbookKey, type SongbookState } from "@/libs/songbookState"
import { readSongbook, subscribeSongbook, writeSongbook } from "@/services/songbookState"

/** The saved state, tagged with the band/user it came from. */
interface TaggedSongbook {
  key: string
  value: SongbookState
}

/** Either a finished set of filters or the updater form the screen already uses. */
export type SongFiltersUpdate = SongFilters | ((current: SongFilters) => SongFilters)

export interface UseSongbookState extends SongbookState {
  setFilters: (next: SongFiltersUpdate) => void
  setSort: (sort: SongSort) => void
}

/**
 * The last filters and order of **this** band for **this** user (roadmap #37).
 *
 * The band id rides along in state exactly as it does in `useReaderState`: when
 * the user switches bands the outgoing entry is still around for a render, and
 * reading it as "nothing saved" keeps that band's facets off the new list
 * instead of showing them for a frame.
 *
 * Hydration runs behind the startup splash, so `readSongbook` is already
 * populated on the first render and nothing swaps in a moment later.
 */
export const useSongbookState = (organizationId: string | null, uid: string | null): UseSongbookState => {
  const key = songbookKey(organizationId, uid)
  const [entry, setEntry] = useState<TaggedSongbook>(() => ({ key, value: readSongbook(key) }))

  useEffect(() => subscribeSongbook(key, (value) => setEntry({ key, value })), [key])

  const value = entry.key === key ? entry.value : EMPTY_SONGBOOK

  // The store notifies the subscription above, and setting here as well keeps
  // the sheet responsive while an identity is still resolving (when nothing is
  // subscribed yet, or the band id has not arrived). Both land in one batch.
  const setFilters = (next: SongFiltersUpdate): void => {
    const resolved = typeof next === "function" ? next(value.filters) : next
    setEntry({ key, value: writeSongbook(key, { filters: resolved }) })
  }

  const setSort = (sort: SongSort): void => {
    setEntry({ key, value: writeSongbook(key, { sort }) })
  }

  return { filters: value.filters, sort: value.sort, setFilters, setSort }
}

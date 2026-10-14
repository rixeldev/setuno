import { useEffect, useState } from "react"

import type { SongFilters } from "@/libs/songSearch"
import type { SongSort } from "@/libs/songbookSort"
import {
  EMPTY_SONGBOOK,
  nextSongbookViewId,
  removeSongbookView,
  songbookKey,
  upsertSongbookView,
  type SongbookState,
  type SongbookView,
} from "@/libs/songbookState"
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
  /** Captures the filters and order now on screen under `name` (roadmap #37B). */
  saveView: (name: string) => void
  /** Restores a view's filters **and** order in one write. */
  applyView: (id: string) => void
  deleteView: (id: string) => void
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

  // Saving a view is a snapshot of what is on screen right now, so it closes
  // over `value` the same way `setFilters`'s updater does — one write, one
  // notification, and the sheet re-renders with the new entry.
  const saveView = (name: string): void => {
    const trimmed = name.trim()
    if (!trimmed) return
    const view: SongbookView = {
      id: nextSongbookViewId(value.views),
      name: trimmed,
      filters: value.filters,
      sort: value.sort,
    }
    setEntry({ key, value: writeSongbook(key, { views: upsertSongbookView(value.views, view) }) })
  }

  const applyView = (id: string): void => {
    const view = value.views.find((candidate) => candidate.id === id)
    if (!view) return
    // Filters and order move together: a view is one decision, not two.
    setEntry({ key, value: writeSongbook(key, { filters: view.filters, sort: view.sort }) })
  }

  const deleteView = (id: string): void => {
    setEntry({ key, value: writeSongbook(key, { views: removeSongbookView(value.views, id) }) })
  }

  return {
    filters: value.filters,
    sort: value.sort,
    views: value.views,
    setFilters,
    setSort,
    saveView,
    applyView,
    deleteView,
  }
}

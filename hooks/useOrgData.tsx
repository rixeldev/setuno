import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import {
  markActivityRead as writeActivityRead,
  subscribeActivity,
  subscribeActivityRead,
} from "@/services/activity"
import { subscribeInvitations, subscribeMembers } from "@/services/organizations"
import {
  nextPerformance,
  partitionPerformances,
  subscribePerformances,
} from "@/services/performances"
import { computeSongStats, subscribeSongs, type SongStats } from "@/services/songs"
import { subscribeSuggestions } from "@/services/suggestions"
import { subscribeSetlists } from "@/services/setlists"
import { songFacets } from "@/libs/songSearch"
import { partitionTrashed } from "@/libs/songTrash"
import { countUnreadActivity } from "@/libs/activityUnread"
import { toFriendlyError } from "@/services/errors"
import type {
  ActivityEvent,
  Invitation,
  OrganizationMember,
  Performance,
  Setlist,
  Song,
  SongSuggestion,
  SongFacets,
} from "@/interfaces"
import { useOrganization } from "@/hooks/useOrganization"
import { useAuth } from "@/hooks/useAuth"

interface OrgDataContextValue {
  songs: Song[]
  /** Soft-deleted songs (roadmap #31) — hidden from every screen but the trash view. */
  trashedSongs: Song[]
  setlists: Setlist[]
  performances: Performance[]
  suggestions: SongSuggestion[]
  pendingSuggestions: SongSuggestion[]
  members: OrganizationMember[]
  invitations: Invitation[]
  activity: ActivityEvent[]
  /** Unread events in the feed, derived against the personal marker (#53). */
  unreadActivityCount: number
  /** Stamps the feed as read — the dashboard calls it on focus. */
  markActivityRead: () => void
  /** Songs indexed by id (memoised lookup for setlists). */
  songLibrary: Map<string, Song>
  facets: SongFacets
  stats: SongStats
  nextShow: Performance | null
  upcomingPerformances: Performance[]
  pastPerformances: Performance[]
  loading: boolean
  error: string | null
}

/** Everything the band has, tagged with the organization it came from. */
interface OrgSnapshot {
  organizationId: string
  songs: Song[]
  setlists: Setlist[]
  performances: Performance[]
  suggestions: SongSuggestion[]
  members: OrganizationMember[]
  invitations: Invitation[]
  activity: ActivityEvent[]
  pending: boolean
  error: string | null
}

const EMPTY: OrgSnapshot = {
  organizationId: "",
  songs: [],
  setlists: [],
  performances: [],
  suggestions: [],
  members: [],
  invitations: [],
  activity: [],
  pending: false,
  error: null,
}

const OrgDataContext = createContext<OrgDataContextValue | null>(null)

/**
 * Subscribes once to every collection of the active organization and shares it
 * with all screens: a single listener per collection keeps reads low and the UI
 * in sync in real time (docs §24, §27).
 *
 * The snapshot is tagged with the organization id, so switching bands shows the
 * new band's data (or nothing at all while it loads) instead of the previous
 * band's contents.
 */
export function OrgDataProvider({ children }: { children: React.ReactNode }) {
  const { organizationId, isAdmin } = useOrganization()
  const { profile } = useAuth()
  const uid = profile?.uid ?? null

  const [snapshot, setSnapshot] = useState<OrgSnapshot>(EMPTY)

  // Roadmap #53: the personal read marker rides alongside the snapshot — it is
  // per user *and* per band, so the value is tagged with the pair it belongs
  // to and anything else reads as "nothing" in render (the #37B tag pattern:
  // never sync a band switch through the effect body). `null` while the user
  // has never stamped it.
  const [readMarker, setReadMarker] = useState<{ key: string; at: Date | null } | null>(null)
  const markerKey = uid && organizationId ? `${uid}/${organizationId}` : ""
  const activityReadAt = readMarker && readMarker.key === markerKey ? readMarker.at : null

  useEffect(() => {
    if (!markerKey) return
    return subscribeActivityRead(uid ?? "", organizationId ?? "", (at) =>
      setReadMarker({ key: markerKey, at }),
    )
  }, [markerKey, uid, organizationId])

  // Switching bands empties the snapshot while rendering, so the previous band's
  // songs are never shown under the new band's name (React's documented
  // "adjust state while rendering" pattern).
  const [snapshotFor, setSnapshotFor] = useState<string | null>(null)
  if (snapshotFor !== organizationId) {
    setSnapshotFor(organizationId)
    setSnapshot({ ...EMPTY, organizationId: organizationId ?? "", pending: organizationId !== null })
  }

  useEffect(() => {
    if (!organizationId) return

    // Every listener created here stops feeding the snapshot as soon as the
    // effect is cleaned up, so a late callback cannot resurrect stale data.
    let cancelled = false

    /** Merges a slice in and clears the loading flag. */
    const merge = (slice: Partial<OrgSnapshot>): void => {
      if (cancelled) return
      setSnapshot((current) => ({ ...current, ...slice, pending: false, error: null }))
    }

    /** A listener dropped: keep the last good data, explain what happened. */
    const onError = (error: Error): void => {
      if (cancelled) return
      setSnapshot((current) => ({
        ...current,
        error: toFriendlyError(error, "We couldn't stay in sync with your band."),
      }))
    }

    const unsubscribers = [
      subscribeSongs(
        organizationId,
        (songs) => merge({ songs }),
        { limit: 500, onError },
      ),
      subscribeSetlists(organizationId, (setlists) => merge({ setlists }), onError),
      subscribePerformances(organizationId, (performances) => merge({ performances }), onError),
      subscribeSuggestions(organizationId, "all", (suggestions) => merge({ suggestions }), onError),
      subscribeMembers(organizationId, (members) => merge({ members }), onError),
      // Invitations are admin-only in the security rules: a plain member reads
      // their own invite through the band switcher, never the collection.
      ...(isAdmin
        ? [subscribeInvitations(organizationId, (invitations) => merge({ invitations }), onError)]
        : []),
      subscribeActivity(organizationId, (activity) => merge({ activity }), 25, onError),
    ]

    return () => {
      cancelled = true
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [organizationId, isAdmin])

  const current = organizationId !== null && snapshot.organizationId === organizationId ? snapshot : EMPTY

  const markRead = useCallback((): void => {
    if (!uid || !organizationId) return
    void writeActivityRead(uid, organizationId)
  }, [uid, organizationId])

  const value = useMemo<OrgDataContextValue>(() => {
    const { upcoming, past } = partitionPerformances(current.performances)
    // One seam for "trashed songs are hidden everywhere" (roadmap #31): every
    // screen reads `songs`, only the trash view asks for `trashedSongs`, and
    // the library keeps both so setlists and annotations still resolve a song
    // that is in the trash.
    const { visible, trashed } = partitionTrashed(current.songs)
    const songLibrary = new Map(current.songs.map((song) => [song.id, song]))
    return {
      songs: visible,
      trashedSongs: trashed,
      setlists: current.setlists,
      performances: current.performances,
      suggestions: current.suggestions,
      pendingSuggestions: current.suggestions.filter((item) => item.status === "pending"),
      members: current.members,
      // Demotions must not leave an admin-only slice behind.
      invitations: isAdmin ? current.invitations : EMPTY.invitations,
      activity: current.activity,
      // Derived, never stored per event: the badge is the feed minus the marker.
      unreadActivityCount: countUnreadActivity(current.activity, activityReadAt),
      markActivityRead: markRead,
      songLibrary,
      facets: songFacets(visible),
      stats: computeSongStats(visible),
      nextShow: nextPerformance(current.performances),
      upcomingPerformances: upcoming,
      pastPerformances: past,
      loading: current.pending,
      error: current.error,
    }
  }, [current, isAdmin, activityReadAt, markRead])

  return <OrgDataContext.Provider value={value}>{children}</OrgDataContext.Provider>
}

export function useOrgData(): OrgDataContextValue {
  const context = useContext(OrgDataContext)
  if (!context) throw new Error("useOrgData must be used inside an OrgDataProvider")
  return context
}
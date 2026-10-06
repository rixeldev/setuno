import React, { createContext, useContext, useEffect, useMemo, useState } from "react"

import { subscribeActivity } from "@/services/activity"
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

interface OrgDataContextValue {
  songs: Song[]
  setlists: Setlist[]
  performances: Performance[]
  suggestions: SongSuggestion[]
  pendingSuggestions: SongSuggestion[]
  members: OrganizationMember[]
  invitations: Invitation[]
  activity: ActivityEvent[]
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

  const [snapshot, setSnapshot] = useState<OrgSnapshot>(EMPTY)

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

  const value = useMemo<OrgDataContextValue>(() => {
    const { upcoming, past } = partitionPerformances(current.performances)
    const songLibrary = new Map(current.songs.map((song) => [song.id, song]))
    return {
      songs: current.songs,
      setlists: current.setlists,
      performances: current.performances,
      suggestions: current.suggestions,
      pendingSuggestions: current.suggestions.filter((item) => item.status === "pending"),
      members: current.members,
      // Demotions must not leave an admin-only slice behind.
      invitations: isAdmin ? current.invitations : EMPTY.invitations,
      activity: current.activity,
      songLibrary,
      facets: songFacets(current.songs),
      stats: computeSongStats(current.songs),
      nextShow: nextPerformance(current.performances),
      upcomingPerformances: upcoming,
      pastPerformances: past,
      loading: current.pending,
      error: current.error,
    }
  }, [current, isAdmin])

  return <OrgDataContext.Provider value={value}>{children}</OrgDataContext.Provider>
}

export function useOrgData(): OrgDataContextValue {
  const context = useContext(OrgDataContext)
  if (!context) throw new Error("useOrgData must be used inside an OrgDataProvider")
  return context
}
import { useEffect, useMemo, useState } from "react"

import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { PRESENCE_HEARTBEAT_MS, PRESENCE_TICK_MS, liveEditors } from "@/libs/editPresence"
import {
  clearSongPresence,
  subscribeSongPresence,
  touchSongPresence,
} from "@/services/songPresence"
import type { SongPresence } from "@/interfaces"

const EMPTY: readonly SongPresence[] = []

/**
 * Edit presence (roadmap #28): while this editor is open the caller's own dot
 * is stamped now, refreshed on every heartbeat and retired on the way out;
 * what comes back is everybody *else* still inside the freshness window — a
 * soft warning, never a lock. The subscription is band+song-tagged (#37B): the
 * snapshot carries its key and a stale key reads as empty in render, never
 * synced in the effect body. Freshness flips on the timer below — never
 * `Date.now()` during render (the React Compiler purity rule).
 */
export const useEditPresence = (songId: string | null): SongPresence[] => {
  const { organizationId } = useOrganization()
  const { user, profile } = useAuth()
  const uid = user?.uid ?? profile?.uid ?? null
  const displayName = profile?.displayName || user?.displayName || user?.email || ""

  const key = organizationId && songId ? `${organizationId}|${songId}` : null
  const [snapshot, setSnapshot] = useState<{ key: string; editors: SongPresence[] } | null>(null)

  useEffect(() => {
    if (!organizationId || !songId) return
    return subscribeSongPresence(organizationId, songId, (editors) => {
      setSnapshot({ key: `${organizationId}|${songId}`, editors })
    })
  }, [organizationId, songId])

  // Own dot: stamp on open, refresh while mounted, retire on the way out.
  // Best-effort like `logActivity` — a rejected heartbeat only lets the
  // notice go quiet, it never touches the edit.
  useEffect(() => {
    if (!organizationId || !songId || !uid) return
    void touchSongPresence(organizationId, songId, uid, displayName).catch(() => undefined)
    const beat = setInterval(() => {
      void touchSongPresence(organizationId, songId, uid, displayName).catch(() => undefined)
    }, PRESENCE_HEARTBEAT_MS)
    return () => {
      clearInterval(beat)
      void clearSongPresence(organizationId, songId, uid).catch(() => undefined)
    }
  }, [organizationId, songId, uid, displayName])

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), PRESENCE_TICK_MS)
    return () => clearInterval(tick)
  }, [])

  const editors = snapshot !== null && snapshot.key === key ? snapshot.editors : EMPTY
  return useMemo(() => liveEditors(editors, uid, now), [editors, uid, now])
}

import { useCallback, useEffect, useMemo, useState } from "react"

import { useAuth } from "@/hooks/useAuth"
import { setFavoriteSong, subscribeFavorites } from "@/services/favorites"

const EMPTY_IDS: string[] = []

/**
 * This user's favorite songs (roadmap #33). The state is tagged with the uid
 * it belongs to (the #37B pattern): on sign-out or account switch the outgoing
 * list still sits in state for a frame, and reading it as "nothing" keeps the
 * previous user's stars off the new screen — never synced in the effect body.
 */
export function useFavorites() {
  const { profile } = useAuth()
  const uid = profile?.uid ?? null
  const [state, setState] = useState<{ uid: string; ids: string[] } | null>(null)

  const favorites = state && state.uid === uid ? state.ids : EMPTY_IDS
  const favoriteSet = useMemo(() => new Set(favorites), [favorites])

  useEffect(() => {
    if (!uid) return
    return subscribeFavorites(uid, (ids) => setState({ uid, ids }))
  }, [uid])

  const setFavorite = useCallback(
    (songId: string, favorite: boolean): Promise<void> =>
      setFavoriteSong(uid ?? "", songId, favorite),
    [uid],
  )

  return {
    favorites,
    favoriteSet,
    isFavorite: (songId: string): boolean => favoriteSet.has(songId),
    setFavorite,
  }
}

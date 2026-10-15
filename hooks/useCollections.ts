import { useCallback, useEffect, useState } from "react"

import { useAuth } from "@/hooks/useAuth"
import {
  addSongsToCollection,
  createCollection,
  deleteCollection,
  removeSongFromCollection,
  renameCollection,
  subscribeCollections,
} from "@/services/collections"
import { toFriendlyError } from "@/services/errors"
import type { UserCollection } from "@/interfaces"

const EMPTY: UserCollection[] = []

/**
 * This user's private collections (roadmap #33), tagged with the uid like
 * `useFavorites` — a stale list can never leak across accounts or bands, and
 * the effect body never syncs state.
 */
export function useCollections() {
  const { profile } = useAuth()
  const uid = profile?.uid ?? null
  const [state, setState] = useState<{ uid: string; collections: UserCollection[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const collections = state && state.uid === uid ? state.collections : EMPTY
  const loading = uid !== null && state === null

  useEffect(() => {
    if (!uid) return
    return subscribeCollections(
      uid,
      (items) => {
        setError(null)
        setState({ uid, collections: items })
      },
      (cause) => setError(toFriendlyError(cause, "We couldn't load your collections.")),
    )
  }, [uid])

  const create = useCallback(
    (name: string, songIds: string[] = []) => createCollection(uid ?? "", name, songIds),
    [uid],
  )
  const rename = useCallback(
    (collectionId: string, name: string) => renameCollection(uid ?? "", collectionId, name),
    [uid],
  )
  const remove = useCallback(
    (collectionId: string) => deleteCollection(uid ?? "", collectionId),
    [uid],
  )
  const addSongs = useCallback(
    (collectionId: string, songIds: string[]) =>
      addSongsToCollection(uid ?? "", collectionId, songIds),
    [uid],
  )
  const removeSong = useCallback(
    (collectionId: string, songId: string) =>
      removeSongFromCollection(uid ?? "", collectionId, songId),
    [uid],
  )

  return { collections, loading, error, create, rename, remove, addSongs, removeSong }
}

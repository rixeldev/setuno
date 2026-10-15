import React from "react"
import { useLocalSearchParams } from "expo-router"

import { SongHistory } from "@/components/songs/SongHistory"

/**
 * Version history of one song (roadmap #26), presented as a modal over the
 * reader. The song title rides in the query string so the panel can label the
 * header without another read.
 */
export default function SongHistoryScreen() {
  const { id, title } = useLocalSearchParams<{ id?: string; title?: string }>()
  if (!id) return null
  return <SongHistory songId={id} songTitle={title ?? ""} />
}

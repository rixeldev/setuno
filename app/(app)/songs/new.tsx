import React from "react"
import { useRouter } from "expo-router"

import { SongForm } from "@/components/songs/SongForm"

/** Create a new song (admin only, enforced by the rules and the guard screen). */
export default function NewSong() {
  const router = useRouter()

  return (
    <SongForm
      title="New song"
      subtitle="Type the lyrics, then add chords above the words"
      onSaved={(songId) => router.replace(`/songs/${songId}`)}
    />
  )
}
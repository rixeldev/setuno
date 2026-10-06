import React from "react"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { SongForm } from "@/components/songs/SongForm"

/** Create a new song (admin only, enforced by the rules and the guard screen). */
export default function NewSong() {
  const router = useRouter()
  const { t } = useTranslation()

  return (
    <SongForm
      title={t("songs.newSong")}
      subtitle={t("songs.newSongSubtitle")}
      onSaved={(songId) => router.replace(`/songs/${songId}`)}
    />
  )
}

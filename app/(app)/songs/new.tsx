import React, { useMemo } from "react"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { SongForm } from "@/components/songs/SongForm"
import { getSongDraft } from "@/libs/ocrDraft"

/**
 * Create a new song (admin only, enforced by the rules and the guard screen).
 *
 * A scanned sheet (roadmap #84) hands its proposal over through the URL: the
 * draft travels in a small store and the URL carries only its token, so the
 * editor opens with the proposal already in it — to be reviewed, fixed and
 * only then saved.
 */
export default function NewSong() {
  const router = useRouter()
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ draft?: string }>()
  const draft = useMemo(() => getSongDraft(params.draft), [params.draft])

  return (
    <SongForm
      title={t("songs.newSong")}
      subtitle={t("songs.newSongSubtitle")}
      draft={draft}
      onSaved={(songId) => router.replace(`/songs/${songId}`)}
    />
  )
}

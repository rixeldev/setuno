import React, { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { TourHint } from "@/components/onboarding/TourHint"
import { SongForm } from "@/components/songs/SongForm"
import { AppBackground } from "@/components/app/AppBackground"
import { EmptyState, Skeleton } from "@/components/ui/States"
import { useOrganization } from "@/hooks/useOrganization"
import { subscribeSong } from "@/services/songs"
import { EDITOR_TOUR } from "@/libs/onboarding"
import type { Song } from "@/interfaces"

/** Edit an existing song: metadata plus the full chord/lyric editor. */
export default function EditSong() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const params = useLocalSearchParams<{ id?: string; tour?: string }>()
  const songId = params.id ?? null
  const { organizationId } = useOrganization()
  const [song, setSong] = useState<Song | null>(null)
  const [ready, setReady] = useState(false)
  // Contextual tips: only while the guided tour walks the editor (roadmap #65).
  const [tourActive, setTourActive] = useState(params.tour === "editor")

  useEffect(() => {
    if (!songId) return
    const unsubscribe = subscribeSong(organizationId, songId, (value) => {
      setSong(value)
      setReady(true)
    })
    return unsubscribe
  }, [organizationId, songId])

  if (!ready) {
    return (
      <View style={styles.host}>
        <AppBackground />
        <Skeleton height={30} width="50%" />
        <Skeleton height={220} />
      </View>
    )
  }

  if (!song) {
    return (
      <View style={styles.host}>
        <AppBackground />
        <EmptyState
          title={t("songs.songNotFound")}
          message={t("songs.songNotFoundEditing")}
          actionLabel={t("songs.backToSongs")}
          onAction={() => router.replace("/songs")}
        />
      </View>
    )
  }

  return (
    <SongForm
      song={song}
      onSaved={() => router.replace(`/songs/${song.id}`)}
      tourHint={
        tourActive ? (
          <TourHint
            steps={EDITOR_TOUR}
            doneLabel={t("onboarding.tourFinish")}
            onDone={() => {
              setTourActive(false)
              router.replace("/")
            }}
            onSkip={() => setTourActive(false)}
          />
        ) : null
      }
    />
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1, padding: Theme.spacing.l, gap: Theme.spacing.l },
  })
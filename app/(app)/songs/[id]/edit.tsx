import React, { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { SongForm } from "@/components/songs/SongForm"
import { AppBackground } from "@/components/app/AppBackground"
import { EmptyState, Skeleton } from "@/components/ui/States"
import { useOrganization } from "@/hooks/useOrganization"
import { subscribeSong } from "@/services/songs"
import type { Song } from "@/interfaces"

/** Edit an existing song: metadata plus the full chord/lyric editor. */
export default function EditSong() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const params = useLocalSearchParams<{ id?: string }>()
  const songId = params.id ?? null
  const { organizationId } = useOrganization()
  const [song, setSong] = useState<Song | null>(null)
  const [ready, setReady] = useState(false)

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

  return <SongForm song={song} onSaved={() => router.replace(`/songs/${song.id}`)} />
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1, padding: Theme.spacing.l, gap: Theme.spacing.l },
  })
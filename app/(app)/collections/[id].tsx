import React from "react"
import { StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { Button, IconButton } from "@/components/ui/Button"
import { EmptyState, SkeletonList } from "@/components/ui/States"
import { CloseIcon, PlusIcon } from "@/components/ui/Icons"
import { AppText } from "@/components/ui/AppText"
import { ModalScreen } from "@/components/app/ModalScreen"
import { SongRow } from "@/components/app/SongRow"
import { useToast } from "@/components/ui/Toast"
import { useCollections } from "@/hooks/useCollections"
import { useOrgData } from "@/hooks/useOrgData"
import { toFriendlyError } from "@/services/errors"
import type { Song } from "@/interfaces"

/**
 * One private collection (roadmap #33): its songs in the order they were
 * filed, each openable or removable, and the hand-off that turns the draft
 * into a real band setlist ("New setlist from collection"). The collection
 * itself stays private — only the setlist it seeds is shared.
 */
export default function CollectionDetailScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { collections, loading, removeSong } = useCollections()
  const { songLibrary } = useOrgData()

  const collection = collections.find((entry) => entry.id === id)
  const songs = collection
    ? collection.songIds
        .map((songId) => songLibrary.get(songId))
        .filter((song): song is Song => song !== undefined)
    : []

  const remove = async (songId: string, title: string): Promise<void> => {
    if (!collection) return
    try {
      await removeSong(collection.id, songId)
      toast.showSuccess(t("collections.removedFrom", { title, name: collection.name }))
    } catch (cause) {
      toast.showError(toFriendlyError(cause, t("collections.couldNotSave")))
    }
  }

  return (
    <ModalScreen
      title={collection ? collection.name || t("collections.untitled") : t("collections.title")}
      subtitle={
        loading
          ? t("collections.loading")
          : collection
            ? t("collections.songCount", { count: songs.length })
            : undefined
      }
    >
      {loading && !collection ? (
        <SkeletonList count={4} height={72} />
      ) : collection === undefined ? (
        <EmptyState
          title={t("collections.gone")}
          message={t("collections.goneMessage")}
          actionLabel={t("collections.backToList")}
          onAction={() => router.replace("/collections")}
        />
      ) : songs.length === 0 ? (
        <EmptyState
          title={t("collections.noSongs")}
          message={t("collections.noSongsMessage")}
          actionLabel={t("collections.openSongbook")}
          onAction={() => router.push("/songs")}
        />
      ) : (
        <View style={styles.list}>
          {songs.map((song) => (
            <SongRow
              key={song.id}
              song={song}
              onPress={() => router.push(`/songs/${song.id}`)}
              right={
                <IconButton
                  label={t("collections.removeA11y", { title: song.title })}
                  variant="secondary"
                  onPress={() => void remove(song.id, song.title)}
                  icon={<CloseIcon size={16} color={Theme.colors.text} />}
                />
              }
            />
          ))}
        </View>
      )}

      {collection && songs.length > 0 ? (
        <View style={styles.draftAction}>
          <Button
            label={t("collections.newFromCollection")}
            variant="primary"
            icon={<PlusIcon size={16} color={Theme.colors.onPrimary} />}
            onPress={() => router.push(`/setlists/new?fromCollection=${collection.id}`)}
          />
          <AppText variant="caption" tone="muted">
            {t("collections.newFromHint")}
          </AppText>
        </View>
      ) : null}
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    list: { gap: Theme.spacing.s },
    draftAction: { gap: Theme.spacing.xs, paddingTop: Theme.spacing.m },
  })

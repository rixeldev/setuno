import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import { TrashIcon } from "@/components/ui/Icons"
import { ModalScreen } from "@/components/app/ModalScreen"
import { SongRow } from "@/components/app/SongRow"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { purgeSong, restoreSong } from "@/services/songs"
import { toFriendlyError } from "@/services/errors"
import { toDate } from "@/interfaces/timestamp"
import type { Song } from "@/interfaces"

/** Whole days since the song was trashed, for the sheet's caption. */
const daysTrashed = (song: Song): number => {
  const stamp = song.deletedAt ? toDate(song.deletedAt)?.getTime() : undefined
  return stamp ? Math.max(0, Math.floor((Date.now() - stamp) / 86_400_000)) : 0
}

/**
 * Trash and recovery (roadmap #31): soft-deleted songs with restore and
 * "delete forever". The list is admin territory — the songbook entry is
 * admin-only and every action is admin-gated by the rules — and a row tap
 * opens the options sheet, so nothing dangerous happens from a stray tap.
 */
export default function SongTrashScreen() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const toast = useToast()
  const { profile } = useAuth()
  const { organizationId } = useOrganization()
  const { trashedSongs, loading, error } = useOrgData()

  // Visibility is separate from the entity, like the members screen: the
  // sheet and the dialog keep the song while they fade out.
  const [menuSong, setMenuSong] = useState<Song | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pendingPurge, setPendingPurge] = useState<Song | null>(null)
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const actor = { id: profile?.uid ?? "", name: profile?.displayName || "An admin" }

  const restore = async (song: Song): Promise<void> => {
    setBusy(true)
    try {
      await restoreSong(organizationId ?? "", song.id, actor)
      toast.showSuccess(t("songs.restoredToast", { title: song.title }))
    } catch (cleanupError) {
      toast.showError(toFriendlyError(cleanupError, t("songs.couldNotRestore")))
    } finally {
      setBusy(false)
    }
  }

  const purge = async (): Promise<void> => {
    const song = pendingPurge
    if (!song) return
    setBusy(true)
    try {
      await purgeSong(organizationId ?? "", song.id, actor)
      setPurgeOpen(false)
      toast.showSuccess(t("songs.purgedToast", { title: song.title }))
    } catch (cleanupError) {
      toast.showError(toFriendlyError(cleanupError, t("songs.couldNotDelete")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalScreen
      title={t("songs.trash")}
      subtitle={t("organizations.songsCount", { count: trashedSongs.length })}
    >
      {loading ? <SkeletonList /> : null}

      {!loading && error ? <ErrorState message={error} /> : null}

      {!loading && !error && trashedSongs.length === 0 ? (
        <EmptyState
          icon={<TrashIcon size={40} color={Theme.colors.textFaint} />}
          title={t("songs.trashEmpty")}
          message={t("songs.trashEmptyDescription")}
        />
      ) : null}

      {!loading && !error && trashedSongs.length > 0 ? (
        <View>
          <AppText variant="caption" tone="muted" style={styles.hint}>
            {t("songs.trashDescription")}
          </AppText>
          <View style={styles.list}>
            {trashedSongs.map((song) => (
              <SongRow
                key={song.id}
                song={song}
                onPress={() => {
                  setMenuSong(song)
                  setMenuOpen(true)
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      <BottomSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={menuSong?.title ?? ""}
        subtitle={
          menuSong
            ? daysTrashed(menuSong) < 1
              ? t("songs.deletedToday")
              : t("songs.deletedAgo", { count: daysTrashed(menuSong) })
            : undefined
        }
      >
        {menuSong ? (
          <>
            <SheetOptionRow
              label={t("songs.restore")}
              onPress={() => {
                const song = menuSong
                setMenuOpen(false)
                void restore(song)
              }}
            />
            <SheetOptionRow
              label={t("songs.deleteForever")}
              onPress={() => {
                setPendingPurge(menuSong)
                setMenuOpen(false)
                setPurgeOpen(true)
              }}
            />
          </>
        ) : null}
      </BottomSheet>

      <Dialog
        visible={purgeOpen}
        onClose={() => setPurgeOpen(false)}
        title={t("songs.deleteForeverConfirm", { title: pendingPurge?.title ?? "" })}
        description={t("songs.deleteForeverDescription")}
        confirmLabel={t("songs.deleteForever")}
        tone="danger"
        confirmLoading={busy}
        onConfirm={() => void purge()}
      />
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    hint: { marginBottom: Theme.spacing.m },
    list: { gap: Theme.spacing.s },
  })

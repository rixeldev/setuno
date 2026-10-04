import React, { useEffect, useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState, Skeleton } from "@/components/ui/States"
import { CopyIcon, EditIcon, FullscreenExitIcon, SuggestIcon, TrashIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { PageHeader } from "@/components/ui/PageHeader"
import { SongContent } from "@/components/songs/SongContent"
import { ImmersiveToggle, SongControls } from "@/components/songs/SongControls"
import { useToast } from "@/components/ui/Toast"
import { useAuth } from "@/hooks/useAuth"
import { useResponsive } from "@/hooks/useResponsive"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { deleteSong, subscribeSong } from "@/services/songs"
import { updatePreferences } from "@/services/users"
import { updateCachedPreferences, usePreferences } from "@/services/prefs"
import { toFriendlyError } from "@/services/errors"
import { transposeKey } from "@/libs/chords"
import { formatRelativeTime, formatDuration } from "@/libs/format"
import { toDate } from "@/interfaces/timestamp"
import type { UserPreferences } from "@/interfaces"
import { songLyricsText } from "@/libs/songUtils"
import * as Clipboard from "expo-clipboard"

/**
 * Song reader / performance view (docs §12): big readable type, display-only
 * transposition, capo, font size and chord visibility.
 */
export default function SongScreen() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { gutter } = useResponsive()
  const params = useLocalSearchParams<{ id?: string }>()
  const songId = params.id ?? null

  const { profile } = useAuth()
  const { organizationId, isAdmin } = useOrganization()
  const { songLibrary, loading } = useOrgData()
  const [song, setSong] = useState(songId ? (songLibrary.get(songId) ?? null) : null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Live document: reflects admin edits and accepted suggestions immediately.
  useEffect(() => subscribeSong(organizationId, songId, setSong), [organizationId, songId])

  const [semitones, setSemitones] = useState(0)
  // The reader's own capo choice; until they move it, the song's own capo is
  // used, so an edit made by an admin shows up without losing the reader's pick.
  const [capoOverride, setCapoOverride] = useState<number | null>(null)
  // Reader display settings come from the local preference cache so they are
  // restored instantly on every start-up (docs §32), then mirrored to the
  // profile so the defaults follow the account across devices.
  const preferences = usePreferences()
  const [fontSize, setFontSize] = useState(preferences.songFontSize)
  const [showChords, setShowChords] = useState(preferences.chordsVisible)
  const [immersive, setImmersive] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)

  const saveDisplayPreference = (patch: Partial<UserPreferences>): void => {
    updateCachedPreferences(patch)
    if (profile?.uid) {
      void updatePreferences(profile.uid, patch).catch(() => undefined)
    }
  }

  const displayKey = useMemo(() => {
    if (!song) return ""
    return transposeKey(song.key, semitones)
  }, [song, semitones])

  // Opening a different song resets the reader controls to their defaults
  // (adjust state while rendering, as documented by React).
  const [readerSongId, setReaderSongId] = useState<string | null>(song?.id ?? null)
  if (song && song.id !== readerSongId) {
    setReaderSongId(song.id)
    setSemitones(0)
    setCapoOverride(null)
  }

  const capo = capoOverride ?? song?.capo ?? 0

  const copyLyrics = async (): Promise<void> => {
    if (!song) return
    await Clipboard.setStringAsync(songLyricsText(song.sections))
    toast.showSuccess("Lyrics and chords copied to the clipboard.")
  }

  const remove = async (): Promise<void> => {
    if (!song) return
    setDeleting(true)
    try {
      await deleteSong(organizationId ?? "", song.id, {
        id: profile?.uid ?? "",
        name: profile?.displayName || "An admin",
      })
      setConfirmDelete(false)
      toast.showSuccess(`"${song.title}" was deleted.`)
      router.replace("/songs")
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't delete that song."))
    } finally {
      setDeleting(false)
    }
  }

  if (!songId) {
    return (
      <ScreenContainer back title="Song">
        <EmptyState title="Song not found" message="This song may have been deleted." />
      </ScreenContainer>
    )
  }

  if (!song) {
    return (
      <View style={styles.host}>
        <PageHeader title="Song" back elevated />
        <View style={[styles.loading, { paddingHorizontal: gutter }]}>
          {loading ? (
            <View style={{ gap: Theme.spacing.m }}>
              <Skeleton height={26} width="60%" />
              <Skeleton height={16} width="40%" />
              <Skeleton height={220} />
            </View>
          ) : (
            <EmptyState
              title="Song not found"
              message="It may have been deleted, or you may not have access to this band."
              actionLabel="Back to songs"
              onAction={() => router.replace("/songs")}
            />
          )}
        </View>
      </View>
    )
  }

  const body = (
    <View style={styles.content}>
      <View style={styles.titleBlock}>
        <AppText variant={immersive ? "display" : "title"}>{song.title}</AppText>
        <AppText variant="body" tone="muted">
          {song.artist || "Unknown artist"}
        </AppText>
        <View style={styles.badges}>
          {song.key ? <Badge label={`Key ${song.key}`} tone="accent" /> : null}
          {song.capo > 0 ? <Badge label={`Capo ${song.capo}`} /> : null}
          {song.bpm ? <Badge label={`${song.bpm} BPM`} /> : null}
          <Badge label={formatDuration(song.durationSec)} />
          {song.genre ? <Badge label={song.genre} /> : null}
        </View>
      </View>

      {song.notes.trim().length > 0 ? (
        <Card style={{ gap: 6 }} onPress={() => setNotesOpen(true)} accessibilityLabel="Open performance notes">
          <AppText variant="label" tone="faint">
            Performance notes
          </AppText>
          <AppText variant="body" tone="muted" numberOfLines={3}>
            {song.notes}
          </AppText>
        </Card>
      ) : null}

      <SongContent sections={song.sections} fontSize={fontSize} showChords={showChords} semitones={semitones} />

      {song.tags.length > 0 ? (
        <View style={styles.badges}>
          {song.tags.map((tag) => (
            <Badge key={tag} label={tag} />
          ))}
        </View>
      ) : null}

      <AppText variant="caption" tone="faint">
        Added by {song.createdByName || "an admin"} · updated {formatRelativeTime(toDate(song.updatedAt))}
      </AppText>

      {song.sections.length === 0 ? (
        <EmptyState
          compact
          title="No lyrics yet"
          message={
            isAdmin
              ? "Open the editor to type the lyrics and add chords."
              : "This song has no lyrics yet. Suggest them to an admin."
          }
          actionLabel={isAdmin ? "Open the editor" : undefined}
          onAction={isAdmin ? () => router.push(`/songs/${song.id}/edit`) : undefined}
        />
      ) : null}
    </View>
  )

  if (immersive) {
    return (
      <View style={[styles.host, styles.immersive, { paddingHorizontal: gutter }]}>
        <View style={styles.immersiveBar}>
          <ImmersiveToggle immersive onToggle={() => setImmersive(false)} />
          <AppText variant="caption" tone="faint">
            {displayKey || song.key}
          </AppText>
        </View>
        {body}
      </View>
    )
  }

  return (
    <View style={styles.host}>
      <PageHeader
        title={song.title}
        subtitle={song.artist || undefined}
        back
        right={
          <>
            <IconButton
              label="Copy lyrics and chords"
              onPress={() => void copyLyrics()}
              icon={<CopyIcon size={18} color={Theme.colors.textMuted} />}
            />
            <IconButton
              label="Stage mode"
              onPress={() => setImmersive(true)}
              icon={<FullscreenExitIcon size={18} color={Theme.colors.textMuted} />}
            />
            {isAdmin ? (
              <IconButton
                label="Edit song"
                onPress={() => router.push(`/songs/${song.id}/edit`)}
                icon={<EditIcon size={18} color={Theme.colors.textMuted} />}
              />
            ) : null}
          </>
        }
        elevated
      />

      <SongControls
        semitones={semitones}
        onSemitonesChange={setSemitones}
        displayKey={displayKey}
        originalKey={song.key}
        capo={capo}
        onCapoChange={setCapoOverride}
        fontSize={fontSize}
        onFontSizeChange={(size) => {
          setFontSize(size)
          saveDisplayPreference({ songFontSize: size })
        }}
        showChords={showChords}
        onToggleChords={() => {
          const next = !showChords
          setShowChords(next)
          saveDisplayPreference({ chordsVisible: next })
        }}
      />

      <View style={[styles.actions, { paddingHorizontal: gutter }]}>
        <Button
          label="Suggest a change"
          variant="secondary"
          size="sm"
          icon={<SuggestIcon size={15} color={Theme.colors.text} />}
          onPress={() => router.push(`/songs/${song.id}/suggest`)}
          style={styles.action}
        />
        {isAdmin ? (
          <Button
            label="Delete song"
            variant="danger"
            size="sm"
            icon={<TrashIcon size={15} color={Theme.colors.onPrimary} />}
            onPress={() => setConfirmDelete(true)}
            style={styles.action}
          />
        ) : null}
      </View>

      <ScreenContainer scroll padded={false} style={[styles.scrollBody, { paddingHorizontal: gutter }]}>
        {body}
      </ScreenContainer>

      <Dialog
        visible={notesOpen}
        onClose={() => setNotesOpen(false)}
        title="Performance notes"
        confirmLabel="Close"
        onConfirm={() => setNotesOpen(false)}
      >
        <AppText variant="body" tone="muted">
          {song.notes}
        </AppText>
      </Dialog>

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete "${song.title}"?`}
        description="The lyrics, chords and notes are removed for the whole band. This can't be undone."
        confirmLabel="Delete song"
        tone="danger"
        confirmLoading={deleting}
        onConfirm={() => void remove()}
      />
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1, backgroundColor: Theme.colors.background },
    loading: { flex: 1, padding: Theme.spacing.l },
    scrollBody: { paddingHorizontal: Theme.spacing.l, paddingTop: Theme.spacing.l },
    content: { gap: Theme.spacing.l, paddingBottom: Theme.spacing.huge },
    titleBlock: { gap: 4 },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
    actions: {
      flexDirection: "row",
      gap: Theme.spacing.s,
      paddingHorizontal: Theme.spacing.l,
      paddingBottom: Theme.spacing.s,
    },
    action: { flexGrow: 1 },
    immersive: { paddingHorizontal: Theme.spacing.l },
    immersiveBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  })
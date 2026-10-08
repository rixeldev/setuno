import React, { useEffect, useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState, Skeleton } from "@/components/ui/States"
import {
  BookIcon,
  ChevronRightIcon,
  CopyIcon,
  EditIcon,
  FullscreenExitIcon,
  FullscreenIcon,
  MusicIcon,
  SuggestIcon,
  TrashIcon,
} from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { AppBackground } from "@/components/app/AppBackground"
import { PageHeader } from "@/components/ui/PageHeader"
import { SongContent } from "@/components/songs/SongContent"
import { ChordShapeSheet } from "@/components/songs/ChordShapeSheet"
import { SongControls } from "@/components/songs/SongControls"
import { SongNavArrows } from "@/components/songs/SongNavArrows"
import { useToast } from "@/components/ui/Toast"
import { useAuth } from "@/hooks/useAuth"
import { useResponsive } from "@/hooks/useResponsive"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { readImmersiveMode, setReaderDirection, writeImmersiveMode } from "@/hooks/useReaderSession"
import { deleteSong, subscribeSong } from "@/services/songs"
import { updatePreferences } from "@/services/users"
import { updateCachedPreferences, usePreferences } from "@/services/prefs"
import { toFriendlyError } from "@/services/errors"
import { displayKey as spellKey, semitonesBetweenKeys, transposeKey } from "@/libs/chords"
import { formatRelativeTime, formatDuration } from "@/libs/format"
import { toDate } from "@/interfaces/timestamp"
import type { UserPreferences } from "@/interfaces"
import { songLyricsText, sectionLabelFor } from "@/libs/songUtils"
import { setlistStep } from "@/libs/setlistNavigation"
import * as Clipboard from "expo-clipboard"

/**
 * Song reader / performance view (docs §12).
 *
 * The screen is ordered like the job: the title and the artist in the header,
 * one slim bar for every display control, then the lyrics — the only thing that
 * matters while playing. Notes, suggestions, sharing and the destructive actions
 * live below the song, so nothing competes with the chords.
 */
export default function SongScreen() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const { gutter } = useResponsive()
  const params = useLocalSearchParams<{ id?: string; setlist?: string }>()
  const songId = params.id ?? null
  // Set by the setlist screen when the song is part of a list: only then does
  // the reader offer the running-order arrows.
  const setlistId = params.setlist ?? null

  const { profile } = useAuth()
  const { organizationId, isAdmin } = useOrganization()
  const { songLibrary, setlists, performances, loading } = useOrgData()
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
  // Solfège ("Do Re Mi") is a display choice stored with the reader settings.
  const notation = preferences.chordNotation ?? "letters"
  const [fontSize, setFontSize] = useState(preferences.songFontSize)
  const [showChords, setShowChords] = useState(preferences.chordsVisible)
  // Stage mode survives the screen swap while stepping through a setlist; the
  // general songbook always opens in the regular layout.
  const [immersive, setImmersive] = useState(() => (setlistId ? readImmersiveMode() : false))
  const [notesOpen, setNotesOpen] = useState(false)
  // Letter chord tapped in the reader; opens the “how to play” sheet.
  const [chordHelp, setChordHelp] = useState<string | null>(null)

  const enterImmersive = (): void => {
    writeImmersiveMode(true)
    setImmersive(true)
  }

  const exitImmersive = (): void => {
    writeImmersiveMode(false)
    setImmersive(false)
  }

  const saveDisplayPreference = (patch: Partial<UserPreferences>): void => {
    updateCachedPreferences(patch)
    if (profile?.uid) {
      void updatePreferences(profile.uid, patch).catch(() => undefined)
    }
  }

  const displayKey = useMemo(() => {
    if (!song) return ""
    return spellKey(transposeKey(song.key, semitones), notation)
  }, [song, semitones, notation])

  // Corner arrows to walk the running order: only for songs opened from a
  // setlist screen, and only when that list really belongs to a live event —
  // never for the general songbook or a draft list.
  const contextSetlist = useMemo(
    () => (setlistId ? (setlists.find((entry) => entry.id === setlistId) ?? null) : null),
    [setlistId, setlists],
  )
  const eventSetlist = useMemo(() => {
    if (!contextSetlist) return null
    const belongsToEvent = performances.some(
      (performance) =>
        performance.status !== "cancelled" &&
        performance.setlists.some((reference) => reference.id === contextSetlist.id),
    )
    return belongsToEvent ? contextSetlist : null
  }, [contextSetlist, performances])

  const step = useMemo(
    () => (song && eventSetlist ? setlistStep(song.id, eventSetlist.songs) : null),
    [eventSetlist, song],
  )

  // Stepping opens the next reader screen and tells the stack which way to
  // animate: "pop" when walking back, "push" when walking forward.
  const openSong = (targetId: string): void => {
    setReaderDirection(step?.previousId === targetId ? "pop" : "push")
    router.replace(setlistId ? `/songs/${targetId}?setlist=${setlistId}` : `/songs/${targetId}`)
  }

  // Opening a different song resets the reader controls to their defaults
  // (adjust state while rendering, as documented by React). A song in an
  // event's setlist additionally opens in the key the band chose for it, and a
  // live change of that key re-applies while the reader is on screen.
  const chosenPlayKey =
    eventSetlist?.songs.find((entry) => entry.songId === song?.id)?.key ?? ""
  const [appliedPlayKey, setAppliedPlayKey] = useState<{ songId: string; key: string } | null>(null)
  if (song && (appliedPlayKey?.songId !== song.id || appliedPlayKey?.key !== chosenPlayKey)) {
    const sameSong = appliedPlayKey?.songId === song.id
    setAppliedPlayKey({ songId: song.id, key: chosenPlayKey })
    setSemitones(chosenPlayKey ? semitonesBetweenKeys(song.key, chosenPlayKey) : 0)
    if (!sameSong) setCapoOverride(null)
  }

  const capo = capoOverride ?? song?.capo ?? 0

  const copyLyrics = async (): Promise<void> => {
    if (!song) return
    await Clipboard.setStringAsync(
      songLyricsText(song.sections, (_section, index) => sectionLabelFor(song.sections, index, t)),
    )
    toast.showSuccess(t("songs.lyricsCopied"))
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
      toast.showError(toFriendlyError(error, t("songs.couldNotDelete")))
    } finally {
      setDeleting(false)
    }
  }

  if (!songId) {
    return (
      <ScreenContainer back title={t("songs.song")}>
        <EmptyState title={t("songs.songNotFound")} message={t("songs.songNotFoundDescription")} />
      </ScreenContainer>
    )
  }

  if (!song) {
    return (
      <View style={styles.host}>
        <AppBackground />
        <PageHeader title={t("songs.song")} back elevated />
        <View style={[styles.loading, { paddingHorizontal: gutter }]}>
          {loading ? (
            <View style={{ gap: Theme.spacing.m }}>
              <Skeleton height={26} width="60%" />
              <Skeleton height={16} width="40%" />
              <Skeleton height={220} />
            </View>
          ) : (
            <EmptyState
              title={t("songs.songNotFound")}
              message={t("songs.songNotFoundDescription")}
              actionLabel={t("songs.backToSongs")}
              onAction={() => router.replace("/songs")}
            />
          )}
        </View>
      </View>
    )
  }

  const lyrics =
    song.sections.length === 0 ? (
      <EmptyState
        compact
        title={t("songs.noLyrics")}
        message={isAdmin ? t("songs.noLyricsAdmin") : t("songs.noLyricsMember")}
        actionLabel={isAdmin ? t("songs.openEditor") : undefined}
        onAction={isAdmin ? () => router.push(`/songs/${song.id}/edit`) : undefined}
      />
    ) : (
      <SongContent
        sections={song.sections}
        fontSize={fontSize}
        showChords={showChords}
        semitones={semitones}
        notation={notation}
        onChordPress={setChordHelp}
      />
    )

  // “How to play” sheet: piano keys or every guitar voicing for the tapped
  // chord, with the current capo applied to the guitar shapes.
  const chordSheet = (
    <ChordShapeSheet
      visible={chordHelp !== null}
      chord={chordHelp}
      capo={capo}
      notation={notation}
      instrument={preferences.chordInstrument ?? "guitar"}
      onInstrumentChange={(next) => saveDisplayPreference({ chordInstrument: next })}
      onClose={() => setChordHelp(null)}
    />
  )

  // Stage mode: only the song, the exit control and the current key.
  if (immersive) {
    return (
      <View style={[styles.host, { paddingHorizontal: gutter }]}>
        <AppBackground />
        <View style={styles.immersiveBar}>
          <View style={styles.immersiveKey}>
            <MusicIcon size={14} color={Theme.colors.primary} />
            <AppText variant="caption" tone="primary">
              {displayKey || song.key}
            </AppText>
          </View>
          <Button
            label={t("songs.exitStageMode")}
            variant="secondary"
            size="sm"
            icon={<FullscreenExitIcon size={15} color={Theme.colors.text} />}
            onPress={exitImmersive}
          />
        </View>
        <ScrollView
          style={styles.immersiveScroll}
          contentContainerStyle={[
            styles.immersiveContent,
            step ? styles.withNavPadding : null,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.immersiveTitle}>
            <AppText variant="display">{song.title}</AppText>
            <AppText variant="body" tone="muted">
              {song.artist || "Unknown artist"}
            </AppText>
          </View>
          {lyrics}
        </ScrollView>

        {step ? (
          <SongNavArrows previousId={step.previousId} nextId={step.nextId} onNavigate={openSong} />
        ) : null}
        {chordSheet}
      </View>
    )
  }

  const details = [
    song.bpm ? `${song.bpm} BPM` : null,
    song.durationSec ? formatDuration(song.durationSec) : null,
    song.genre || null,
  ].filter((value): value is string => Boolean(value))
  const hasNotes = song.notes.trim().length > 0

  return (
    <View style={styles.host}>
      <AppBackground />
      <PageHeader
        title={song.title}
        subtitle={song.artist || undefined}
        dense
        back
        elevated
        right={
          <>
            <IconButton
              label={t("songs.stageMode")}
              onPress={enterImmersive}
              icon={<FullscreenIcon size={18} color={Theme.colors.textMuted} />}
            />
            {isAdmin ? (
              <IconButton
                label={t("songs.editSong")}
                onPress={() => router.push(`/songs/${song.id}/edit`)}
                icon={<EditIcon size={18} color={Theme.colors.textMuted} />}
              />
            ) : null}
          </>
        }
      />

      <SongControls
        semitones={semitones}
        onSemitonesChange={setSemitones}
        displayKey={displayKey}
        originalKey={spellKey(song.key, notation)}
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
        notation={notation}
        onNotationChange={(next) => saveDisplayPreference({ chordNotation: next })}
      />

      <ScreenContainer scroll padded={false} style={[styles.scrollBody, { paddingHorizontal: gutter }]}>
        <View style={[styles.content, step ? styles.withNavPadding : null]}>
          {details.length > 0 ? (
            <AppText variant="caption" tone="faint">
              {details.join("  ·  ")}
            </AppText>
          ) : null}

          {hasNotes ? (
            <Pressable
              onPress={() => setNotesOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("songs.performanceNotes")}
              style={({ pressed }) => [styles.notes, pressed && styles.pressed]}
            >
              <BookIcon size={16} color={Theme.colors.primary} />
              <View style={styles.flex}>
                <AppText variant="caption" tone="muted">
                  {t("songs.performanceNotes")}
                </AppText>
                <AppText variant="caption" tone="faint" numberOfLines={1}>
                  {song.notes}
                </AppText>
              </View>
              <ChevronRightIcon size={16} color={Theme.colors.textFaint} />
            </Pressable>
          ) : null}

          {lyrics}

          {isAdmin ? null : (
            <Button
              label={t("songs.suggestChange")}
              variant="secondary"
              icon={<SuggestIcon size={15} color={Theme.colors.text} />}
              onPress={() => router.push(`/songs/${song.id}/suggest`)}
            />
          )}

          <View style={styles.footer}>
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

            <View style={styles.footerActions}>
              <Pressable
                onPress={() => void copyLyrics()}
                accessibilityRole="button"
                accessibilityLabel={t("songs.copyA11y")}
                style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
              >
                <CopyIcon size={15} color={Theme.colors.textMuted} />
                <AppText variant="caption" tone="muted">
                  {t("songs.copyLyrics")}
                </AppText>
              </Pressable>

              {isAdmin ? (
                <Pressable
                  onPress={() => setConfirmDelete(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t("songs.deleteSong")}
                  style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
                >
                  <TrashIcon size={15} color={Theme.colors.danger} />
                  <AppText variant="caption" tone="danger">
                    {t("songs.deleteSong")}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </ScreenContainer>

      <Dialog
        visible={notesOpen}
        onClose={() => setNotesOpen(false)}
        title={t("songs.performanceNotes")}
        confirmLabel={t("common.close")}
        onConfirm={() => setNotesOpen(false)}
      >
        <AppText variant="body" tone="muted">
          {song.notes}
        </AppText>
      </Dialog>

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("songs.deleteSongConfirm", { title: song.title })}
        description={t("songs.deleteSongDescription")}
        confirmLabel={t("songs.deleteSong")}
        tone="danger"
        confirmLoading={deleting}
        onConfirm={() => void remove()}
      />

      {step ? (
        <SongNavArrows previousId={step.previousId} nextId={step.nextId} onNavigate={openSong} />
      ) : null}
      {chordSheet}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1 },
    flex: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.7 },
    loading: { flex: 1, padding: Theme.spacing.l },
    scrollBody: { paddingTop: Theme.spacing.l },
    content: { gap: Theme.spacing.l, paddingBottom: Theme.spacing.huge },
    notes: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.m,
      paddingHorizontal: Theme.spacing.l,
      borderRadius: Theme.radii.lg,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.surface,
    },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    footer: {
      gap: Theme.spacing.m,
      paddingTop: Theme.spacing.m,
      borderTopWidth: 1,
      borderTopColor: Theme.colors.borderSoft,
    },
    footerActions: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.xl },
    footerLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 4,
    },
    immersiveScroll: { flex: 1 },
    immersiveBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.m,
      paddingTop: Theme.spacing.s,
      paddingBottom: Theme.spacing.l,
    },
    immersiveKey: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: 8,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.surface,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
    },
    immersiveContent: {
      gap: Theme.spacing.l,
      paddingTop: Theme.spacing.l,
      paddingBottom: Theme.spacing.huge,
    },
    immersiveTitle: { gap: 2 },
    // Room for the corner arrows so they never cover the last lines.
    withNavPadding: { paddingBottom: Theme.spacing.huge + 56 },
  })

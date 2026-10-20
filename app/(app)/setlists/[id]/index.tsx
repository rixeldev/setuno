import React, { useMemo, useState } from "react"
import { FlatList, Pressable, StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card, Chip } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState } from "@/components/ui/States"
import { Input, SearchInput } from "@/components/ui/Input"
import { useToast } from "@/components/ui/Toast"
import { CloseIcon, DotsIcon, EditIcon, MusicIcon, NoteIcon, PlusIcon, SparklesIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { SetlistKeyDialog } from "@/components/setlists/SetlistKeyDialog"
import { SetlistBlockDialog } from "@/components/setlists/SetlistBlockDialog"
import { SetlistNoteDialog } from "@/components/setlists/SetlistNoteDialog"
import { PrintSheet } from "@/components/songs/PrintSheet"
import { ShareSheet } from "@/components/shares/ShareSheet"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { useCopyDeepLink } from "@/hooks/useCopyDeepLink"
import {
  deleteSetlist,
  duplicateSetlist,
  saveSetlistAsTemplate,
  setlistSongKeys,
  setlistSongNotes,
  setSetlistTemplate,
  updateSetlist,
  updateSetlistSongKey,
} from "@/services/setlists"
import { toFriendlyError } from "@/services/errors"
import { filterSongs, EMPTY_FILTERS, songDurationSec } from "@/libs/songSearch"
import { isPickableForSetlist } from "@/libs/songStatus"
import { ROTATION_MISSED_EVENTS, rotationSuggestions } from "@/libs/songUsage"
import { setlistPrintHtml } from "@/libs/songPrint"
import type { RelativeDayLabels } from "@/libs/format"
import {
  formatDateRange,
  formatDuration,
  formatDurationLong,
  formatRelativeDay,
} from "@/libs/format"
import { parseIsoDate } from "@/libs/validation"
import { estimateDurationSec } from "@/libs/songUtils"
import {
  durationGoalTargetLabel,
  durationGoalText,
  MAX_GOAL_MINUTES,
  parseGoalMinutes,
  setlistGoal,
} from "@/libs/setlistDuration"
import { cleanBlockName, insertBlock, listRows, removeBlock, removeEntry, renameBlock } from "@/libs/setlistBlocks"
import {
  ASSISTANT_DEFAULT_MINUTES,
  buildRepertoireDraft,
} from "@/libs/repertoireAssistant"
import type { SetlistBlock } from "@/interfaces/setlist"
import { displayKey } from "@/libs/chords"
import { usePreferences } from "@/services/prefs"

/** Fields the running-order editor can change; the rest always ride along. */
interface OrderPatch {
  songIds?: string[]
  songKeys?: Record<string, string>
  songNotes?: Record<string, string>
  blocks?: SetlistBlock[]
}

/**
 * Setlist detail (docs §20), built for playing live: the running order is the
 * screen, rows open the song, and every management action (reorder, add,
 * duplicate, delete…) stays behind the options sheet and an edit mode.
 */
export default function SetlistDetail() {
  const { t, i18n } = useTranslation()
  const dayLabels: RelativeDayLabels = {
    today: t("common.today"),
    tomorrow: t("common.tomorrow"),
    yesterday: t("common.yesterday"),
  }
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const copyDeepLink = useCopyDeepLink()
  const params = useLocalSearchParams<{ id?: string }>()
  const setlistId = params.id ?? null

  const { profile } = useAuth()
  const { organizationId, isAdmin } = useOrganization()
  const { setlists, songs, songLibrary, performances, songUsage } = useOrgData()
  // Keys are stored in letters; the reader settings decide how they are spelled.
  const notation = usePreferences().chordNotation ?? "letters"

  const [editing, setEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState("")
  // Retired songs are hidden from the picker by default (roadmap #30); the
  // chip below only shows up once there is actually something to reveal.
  const [showRetired, setShowRetired] = useState(false)
  // Rotation mode (roadmap #44): the picker lists the songs the band has not
  // played in the last few events, most neglected first, instead of A→Z.
  const [rotationOnly, setRotationOnly] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  // The repertoire assistant (roadmap #86): the minutes it aims for and
  // whether it fills the list or replaces the running order.
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantMinutes, setAssistantMinutes] = useState("")
  const [assistantMode, setAssistantMode] = useState<"add" | "replace">("add")
  // "Save as template" asks what to call the template, the way the songbook's
  // saved views do — the name is what the band will look for later.
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState("")
  // Song whose play key is being chosen, and whether it is being added from
  // the picker or changed from the running order.
  const [keyTarget, setKeyTarget] = useState<{
    songId: string
    title: string
    originalKey: string
    key: string
    mode: "add" | "edit"
  } | null>(null)
  // Divider being inserted (anchored after a song) or renamed, with its text:
  // controlled, seeded by the press that opens it — never by an effect.
  const [blockTarget, setBlockTarget] = useState<{
    mode: "insert" | "rename"
    blockId: string | null
    afterSongId: string | null
    name: string
  } | null>(null)
  // Entry whose shared note is being edited ("tune Eb", "starts alone").
  const [noteTarget, setNoteTarget] = useState<{
    songId: string
    title: string
    note: string
  } | null>(null)

  const setlist = useMemo(
    () => setlists.find((entry) => entry.id === setlistId) ?? null,
    [setlists, setlistId],
  )
  // Derived, never stored: the readout follows the running order as songs come
  // and go, because every edit on this screen round-trips through the listener
  // (Firestore echoes the write locally first, so it lands immediately).
  const goal = setlist ?
    setlistGoal({
      targetMinutes: setlist.targetMinutes,
      breakMinutes: setlist.breakMinutes,
      estimatedDurationSec: setlist.estimatedDurationSec,
    })
  : null
  /**
   * The running order as rows — dividers interleaved with their songs (the
   * song number on a row counts songs only). Pure: the anchor an "insert
   * divider" bar needs is derived from the row's position, never accumulated.
   */
  const rows = useMemo(
    () => listRows(setlist?.songs ?? [], setlist?.blocks ?? []),
    [setlist?.songs, setlist?.blocks],
  )
  // Full documents for the printed sheet: each entry carries the key the band
  // plays that song in. A song deleted since the list was built drops out
  // instead of blanking its page.
  const printableSongs = useMemo(
    () =>
      (setlist?.songs ?? []).flatMap((entry) => {
        const song = songLibrary.get(entry.songId)
        return song ? [{ song, key: entry.key }] : []
      }),
    [setlist?.songs, songLibrary],
  )
  // Shows that have this setlist attached, newest first (reverse of the link
  // the performance form creates).
  const relatedShows = useMemo(
    () =>
      setlistId === null
        ? []
        : performances
            .filter(
              (performance) =>
                performance.setlists.some((entry) => entry.id === setlistId) &&
                performance.status !== "cancelled",
            )
            .sort((a, b) => b.date.localeCompare(a.date)),
    [performances, setlistId],
  )
  const actor = {
    id: profile?.uid ?? "",
    name: profile?.displayName || "An admin",
  }

  /**
   * Every write this screen makes to the running order goes through here. The
   * state on screen is the base and the action's own piece is the patch, so
   * the fields that are *not* part of an action — the goal, the notes, the
   * dividers — are carried explicitly rather than by accident (#42 and #43
   * both hang off this: an omitted optional would wipe them on the next
   * reorder).
   */
  const persistOrder = async (patch: OrderPatch = {}): Promise<void> => {
    if (!setlist) return
    try {
      await updateSetlist(
        organizationId ?? "",
        setlist.id,
        {
          name: setlist.name,
          description: setlist.description,
          date: setlist.date,
          notes: setlist.notes,
          songIds: patch.songIds ?? setlist.songs.map((entry) => entry.songId),
          songKeys: patch.songKeys ?? setlistSongKeys(setlist.songs),
          songNotes: patch.songNotes ?? setlistSongNotes(setlist.songs),
          blocks: patch.blocks ?? setlist.blocks,
          targetMinutes: setlist.targetMinutes,
          breakMinutes: setlist.breakMinutes,
        },
        songLibrary,
        actor,
      )
    } catch (error) {
      toast.showError(toFriendlyError(error, t("setlists.couldNotUpdateOrder")))
    }
  }

  const move = (index: number, delta: number): void => {
    if (!setlist) return
    const ids = setlist.songs.map((entry) => entry.songId)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    const [moved] = ids.splice(index, 1)
    ids.splice(target, 0, moved)
    // Keys, notes and dividers are all keyed by song id, so they follow the
    // song without being mentioned.
    void persistOrder({ songIds: ids })
  }

  const removeSong = (songId: string): void => {
    if (!setlist) return
    const next = removeEntry(setlist.songs, setlist.blocks, songId)
    void persistOrder({
      songIds: next.songs.map((entry) => entry.songId),
      // The dividers that pointed at the removed song are re-anchored to the
      // gap it used to fill — dropping them here would take the band's sets
      // away with the song.
      blocks: next.blocks,
    })
  }

  const addSongs = (ids: string[], keys: Record<string, string> = {}): void => {
    if (!setlist || ids.length === 0) {
      setPickerOpen(false)
      return
    }
    const existing = setlist.songs.map((entry) => entry.songId)
    void persistOrder({
      songIds: [...existing, ...ids],
      songKeys: {
        ...setlistSongKeys(setlist.songs),
        ...keys,
      },
    })
    setPickerOpen(false)
    setSearch("")
    toast.showSuccess(t("setlists.songsAdded", { count: ids.length }))
  }

  /**
   * The repertoire assistant (roadmap #86): drafts a running order from the
   * slot, the rotation and the energy. It is only a draft — the band
   * rearranges it afterwards like any other order.
   */
  const openAssistant = (): void => {
    setAssistantMinutes(
      setlist && setlist.targetMinutes > 0 ? `${setlist.targetMinutes}` : "",
    )
    setAssistantMode("add")
    setAssistantOpen(true)
  }

  const applyAssistant = (): void => {
    if (!setlist) return
    const pool = songs
      .filter((song) => isPickableForSetlist(song, showRetired))
      .filter((song) => !setlist.songs.some((entry) => entry.songId === song.id))
    const existing = assistantMode === "replace" ? [] : setlist.songs.map((entry) => entry.songId)
    const draft = buildRepertoireDraft({
      songs: pool.map((song) => ({
        id: song.id,
        title: song.title,
        bpm: song.bpm,
        durationSec: songDurationSec(song),
      })),
      usage: songUsage,
      existingSongIds: existing,
      // The goal is for the whole set, so the music already there counts —
      // unless the draft is replacing the running order.
      existingSec: assistantMode === "replace" ? 0 : setlist.estimatedDurationSec,
      targetMinutes: parseGoalMinutes(assistantMinutes, MAX_GOAL_MINUTES),
      breakMinutes: setlist.breakMinutes,
    })
    setAssistantOpen(false)
    if (draft.songIds.length === 0) {
      toast.showError(t("setlists.assistantEmpty"))
      return
    }
    void persistOrder({ songIds: [...existing, ...draft.songIds] })
    toast.showSuccess(t("setlists.assistantApplied", { count: draft.songIds.length }))
  }

  /** Inserts a new divider, or renames the one picked — one dialog, two modes. */
  const submitBlock = (name: string): void => {
    if (!setlist || !blockTarget) return
    const cleaned = cleanBlockName(name)
    if (cleaned.length === 0) return
    if (blockTarget.mode === "insert") {
      void persistOrder({
        blocks: insertBlock(setlist.blocks, cleaned, blockTarget.afterSongId),
      })
    } else if (blockTarget.blockId) {
      void persistOrder({
        blocks: renameBlock(setlist.blocks, blockTarget.blockId, cleaned),
      })
    }
    setBlockTarget(null)
  }

  /**
   * Writes the entry's note. An empty value is a deliberate clear — absence is
   * what "no note" means, so `normalizeInput` drops it instead of storing "".
   * Notes are keyed by song id, so this reorder-safe write never moves one to
   * a different row.
   */
  const submitNote = (note: string): void => {
    if (!setlist || !noteTarget) return
    void persistOrder({
      songNotes: {
        ...setlistSongNotes(setlist.songs),
        [noteTarget.songId]: note,
      },
    })
    setNoteTarget(null)
  }

  const changeKey = async (songId: string, key: string): Promise<void> => {
    if (!setlist) return
    try {
      await updateSetlistSongKey(organizationId ?? "", setlist.id, songId, key)
    } catch (error) {
      toast.showError(toFriendlyError(error, t("setlists.couldNotChangeKey")))
    }
  }

  const pickKey = (key: string): void => {
    if (!keyTarget) return
    const target = keyTarget
    setKeyTarget(null)
    if (target.mode === "add") {
      addSongs([target.songId], { [target.songId]: key })
      return
    }
    void changeKey(target.songId, key)
  }

  const duplicate = async (): Promise<void> => {
    if (!setlist) return
    setBusy(true)
    try {
      const id = await duplicateSetlist(
        organizationId ?? "",
        setlist.id,
        t("setlists.copySuffix"),
        actor,
      )
      toast.showSuccess(t("setlists.duplicated"))
      router.replace(`/setlists/${id}`)
    } catch (error) {
      toast.showError(toFriendlyError(error, t("setlists.couldNotDuplicate")))
    } finally {
      setBusy(false)
    }
  }

  /** Saves a copy flagged as a template; the list on screen is left alone. */
  const saveTemplate = async (): Promise<void> => {
    if (!setlist) return
    const name = templateName.trim()
    if (name.length === 0) return
    setBusy(true)
    try {
      const id = await saveSetlistAsTemplate(organizationId ?? "", setlist.id, name, actor)
      setSavingTemplate(false)
      setTemplateName("")
      toast.showSuccess(t("setlists.templateSaved", { name }))
      router.replace(`/setlists/${id}`)
    } catch (error) {
      // The dialog stays open: the name the user typed is still worth keeping.
      toast.showError(toFriendlyError(error, t("setlists.couldNotSaveTemplate")))
    } finally {
      setBusy(false)
    }
  }

  const dropTemplate = async (): Promise<void> => {
    if (!setlist) return
    setBusy(true)
    try {
      await setSetlistTemplate(organizationId ?? "", setlist.id, false, actor)
      toast.showSuccess(t("setlists.templateRemoved", { name: setlist.name }))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("setlists.couldNotUpdateTemplate")))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    if (!setlist) return
    setBusy(true)
    try {
      await deleteSetlist(organizationId ?? "", setlist.id, actor)
      setConfirmDelete(false)
      toast.showSuccess(t("setlists.setlistDeleted", { name: setlist.name }))
      router.replace("/setlists")
    } catch (error) {
      toast.showError(toFriendlyError(error, t("setlists.couldNotDelete")))
    } finally {
      setBusy(false)
    }
  }

  if (!setlistId) {
    return (
      <ScreenContainer back title={t("setlists.setlist")}>
        <EmptyState
          title={t("setlists.setlistNotFound")}
          message={t("setlists.pickOne")}
        />
      </ScreenContainer>
    )
  }

  if (!setlist) {
    return (
      <ScreenContainer back title={t("setlists.setlist")}>
        <EmptyState
          title={t("setlists.setlistNotFound")}
          message={t("setlists.setlistNotFoundDescription")}
          actionLabel={t("setlists.backToSetlists")}
          onAction={() => router.replace("/setlists")}
        />
      </ScreenContainer>
    )
  }

  const hasRetired = songs.some((song) => song.status === "retired")
  const pool = filterSongs(songs, { ...EMPTY_FILTERS, search })
    .filter((song) => !setlist.songs.some((entry) => entry.songId === song.id))
    .filter((song) => isPickableForSetlist(song, showRetired))
  // Rotation mode (roadmap #44): the same pool, most neglected first. Derived
  // from `songUsage` (already in `useOrgData` since #34), so nothing new is
  // stored and a deleted event cannot leave a stale suggestion behind.
  const rotation = rotationSuggestions(pool, songUsage)
  const candidates = rotationOnly ? rotation.map(({ song }) => song) : pool
  /** In rotation mode the second line says *why* it is suggested (#34's own phrasing). */
  const pickerCaption = (songId: string, artist: string): string => {
    if (!rotationOnly) return artist || t("common.unknownArtist")
    const entry = songUsage.get(songId)
    if (!entry) return t("songs.usageNever")
    if (entry.eventsAgo === 0) return t("songs.lastPlayedLatest")
    return t("songs.lastPlayedAgo", { count: entry.eventsAgo })
  }
  const runsLabel = t("setlists.songsCount", {
    count: setlist.songs.length,
    duration: formatDurationLong(setlist.estimatedDurationSec),
  })
  const dateLabel = setlist.date
    ? formatRelativeDay(parseIsoDate(setlist.date), dayLabels)
    : ""
  // A template has no date, so this reads "Template · 12 songs · 45 min".
  const subtitle = [setlist.template ? t("setlists.templateBadge") : "", dateLabel, runsLabel]
    .filter(Boolean)
    .join(" · ")
  const hasNotes =
    setlist.description.trim().length > 0 || setlist.notes.trim().length > 0

  return (
    <ScreenContainer
      back
      title={setlist.name}
      subtitle={subtitle}
      large
      titleLines={2}
      headerRight={
        isAdmin ? (
          editing ? (
            <Button
              label={t("common.done")}
              size="sm"
              variant="ghost"
              onPress={() => setEditing(false)}
            />
          ) : (
            <IconButton
              label={t("setlists.manage")}
              onPress={() => setMenuOpen(true)}
              icon={<DotsIcon size={18} color={Theme.colors.textMuted} />}
            />
          )
        ) : null
      }
    >
      {hasNotes ? (
        <View style={styles.notes}>
          {setlist.description.trim().length > 0 ? (
            <AppText variant="body" tone="muted">
              {setlist.description}
            </AppText>
          ) : null}
          {setlist.notes.trim().length > 0 ? (
            <AppText variant="caption" tone="faint">
              {setlist.notes}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {setlist.songs.length === 0 ? (
        <EmptyState
          icon={<MusicIcon size={24} color={Theme.colors.primary} />}
          title={t("setlists.noSongsYet")}
          message={t("setlists.addSongsHint")}
          actionLabel={isAdmin ? t("setlists.addSongs") : undefined}
          onAction={isAdmin ? () => setPickerOpen(true) : undefined}
        />
      ) : (
        <Card padded={false} style={styles.listCard}>
          {rows.map((row, rowIndex) => {
            if (row.kind === "block") {
              const block = row.block
              return (
                <View key={`block-${block.id}`} style={[styles.songRow, styles.blockRow]}>
                  <View style={styles.blockLabelRow}>
                    <View style={styles.blockLine} />
                    <AppText
                      variant="label"
                      tone="accent"
                      numberOfLines={1}
                      style={styles.blockName}
                    >
                      {block.name}
                    </AppText>
                    <View style={styles.blockLine} />
                  </View>
                  {editing ? (
                    <View style={styles.blockActions}>
                      <IconButton
                        label={t("setlists.renameBlock")}
                        size={30}
                        onPress={() =>
                          setBlockTarget({
                            mode: "rename",
                            blockId: block.id,
                            afterSongId: block.afterSongId,
                            name: block.name,
                          })
                        }
                        icon={<EditIcon size={15} color={Theme.colors.textMuted} />}
                      />
                      <IconButton
                        label={t("setlists.removeBlock")}
                        size={30}
                        onPress={() =>
                          void persistOrder({
                            blocks: removeBlock(setlist.blocks, block.id),
                          })
                        }
                        icon={<CloseIcon size={15} color={Theme.colors.danger} />}
                      />
                    </View>
                  ) : null}
                </View>
              )
            }

            const { entry, order } = row
            // Position among the *songs*: a divider never takes a number, so
            // this is both what the running order shows and what `move` indexes.
            const index = order - 1
            // A divider sits *after* a song, so the bar above this song goes
            // after the previous one (`null` at the top). Anchoring to the song
            // the bar precedes would put the new divider on the wrong side of
            // every divider already in that gap.
            const afterSongId =
              index > 0 ? (setlist.songs[index - 1]?.songId ?? null) : null
            const song = songLibrary.get(entry.songId)
            const seconds = song
              ? (song.durationSec ?? estimateDurationSec(song.sections))
              : null
            return (
              <React.Fragment key={`${entry.songId}-${order}`}>
                {editing ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("setlists.insertBlockBefore", {
                      title: entry.title,
                    })}
                    hitSlop={4}
                    onPress={() =>
                      setBlockTarget({
                        mode: "insert",
                        blockId: null,
                        afterSongId,
                        name: "",
                      })
                    }
                    style={({ pressed }) => [
                      styles.insertBar,
                      pressed && styles.pressed,
                    ]}
                  >
                    <PlusIcon size={12} color={Theme.colors.textFaint} />
                  </Pressable>
                ) : null}
                <View
                  style={[styles.songRow, rowIndex > 0 && styles.songDivider]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("setlists.openSong", {
                      title: entry.title,
                    })}
                    onPress={() =>
                      router.push(
                        relatedShows.length > 0
                          ? `/songs/${entry.songId}?setlist=${setlist.id}`
                          : `/songs/${entry.songId}`,
                      )
                    }
                    style={({ pressed }) => [
                      styles.songMain,
                      pressed && styles.pressed,
                    ]}
                  >
                    <AppText variant="caption" tone="faint" style={styles.order}>
                      {order}
                    </AppText>
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {entry.title}
                      </AppText>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>
                        {[
                          entry.artist || t("common.unknownArtist"),
                          formatDuration(seconds),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </AppText>
                      {entry.note ? (
                        <View style={styles.noteLine}>
                          <NoteIcon size={12} color={Theme.colors.accent} />
                          <AppText
                            variant="caption"
                            tone="muted"
                            numberOfLines={2}
                            style={styles.flex}
                          >
                            {entry.note}
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>

                  {editing ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("setlists.changeKey")}
                      hitSlop={Theme.hitSlop}
                      onPress={() =>
                        setKeyTarget({
                          songId: entry.songId,
                          title: entry.title,
                          originalKey: song?.key ?? "",
                          key: entry.key,
                          mode: "edit",
                        })
                      }
                      style={({ pressed }) => [pressed && styles.pressed]}
                    >
                      <Badge
                        label={entry.key ? displayKey(entry.key, notation) : "—"}
                        tone="accent"
                        style={styles.keyBadge}
                      />
                    </Pressable>
                  ) : entry.key ? (
                    <Badge
                      label={displayKey(entry.key, notation)}
                      tone="accent"
                      style={styles.keyBadge}
                    />
                  ) : null}

                  {editing ? (
                    <View style={styles.rowActions}>
                      <IconButton
                        label={t("setlists.moveUp")}
                        size={30}
                        disabled={index === 0}
                        onPress={() => move(index, -1)}
                        icon={
                          <AppText
                            variant="bodyStrong"
                            tone={index === 0 ? "faint" : "muted"}
                          >
                            ↑
                          </AppText>
                        }
                      />
                      <IconButton
                        label={t("setlists.moveDown")}
                        size={30}
                        disabled={index === setlist.songs.length - 1}
                        onPress={() => move(index, 1)}
                        icon={
                          <AppText
                            variant="bodyStrong"
                            tone={
                              index === setlist.songs.length - 1
                                ? "faint"
                                : "muted"
                            }
                          >
                            ↓
                          </AppText>
                        }
                      />
                      <IconButton
                        label={t("setlists.editNote")}
                        size={30}
                        onPress={() =>
                          setNoteTarget({
                            songId: entry.songId,
                            title: entry.title,
                            note: entry.note,
                          })
                        }
                        icon={
                          <NoteIcon
                            size={15}
                            color={
                              entry.note
                                ? Theme.colors.accent
                                : Theme.colors.textMuted
                            }
                          />
                        }
                      />
                      <IconButton
                        label={t("setlists.removeFromSetlist")}
                        size={30}
                        onPress={() => removeSong(entry.songId)}
                        icon={<CloseIcon size={15} color={Theme.colors.danger} />}
                      />
                    </View>
                  ) : null}
                </View>
              </React.Fragment>
            )
          })}
        </Card>
      )}

      {goal ? (
        <View style={styles.goal}>
          <AppText variant="caption" tone="faint" style={styles.flex}>
            {durationGoalTargetLabel(goal, t)}
          </AppText>
          <AppText
            variant="bodyStrong"
            tone={goal.over ? "danger" : goal.onTarget ? "success" : "accent"}
          >
            {durationGoalText(goal, t)}
          </AppText>
        </View>
      ) : null}

      {isAdmin && editing ? (
        <View style={styles.assistantRow}>
          <Button
            label={t("setlists.addSongs")}
            icon={<PlusIcon size={16} color={Theme.colors.onPrimary} />}
            onPress={() => setPickerOpen(true)}
            style={styles.flex}
          />
          {/* The repertoire assistant (roadmap #86): a draft running order
              from the slot, the rotation and the energy. */}
          <Button
            label={t("setlists.assistantSuggest")}
            variant="secondary"
            icon={<SparklesIcon size={16} color={Theme.colors.textMuted} />}
            onPress={openAssistant}
            style={styles.flex}
          />
        </View>
      ) : null}

      {relatedShows.length > 0 ? (
        <View style={styles.shows}>
          <AppText variant="label" tone="faint">
            {t("setlists.usedInShows")}
          </AppText>
          {relatedShows.slice(0, 3).map((performance) => (
            <Pressable
              key={performance.id}
              accessibilityRole="button"
              accessibilityLabel={performance.name}
              onPress={() => router.push(`/performances/${performance.id}`)}
              style={({ pressed }) => [
                styles.showLine,
                pressed && styles.pressed,
              ]}
            >
              <AppText
                variant="caption"
                tone="muted"
                numberOfLines={1}
                style={styles.flex}
              >
                {performance.name}
              </AppText>
              <AppText variant="caption" tone="faint" numberOfLines={1}>
                {formatDateRange(
                  performance.date,
                  performance.endDate,
                  i18n.language,
                )}
              </AppText>
            </Pressable>
          ))}
          {relatedShows.length > 3 ? (
            <AppText variant="caption" tone="faint">
              {t("setlists.moreShows", { count: relatedShows.length - 3 })}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <BottomSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={setlist.name}
        subtitle={runsLabel}
      >
        <SheetOptionRow
          label={t("setlists.editOrder")}
          hint={t("setlists.editOrderHint")}
          onPress={() => {
            setMenuOpen(false)
            setEditing(true)
          }}
        />
        <SheetOptionRow
          label={t("setlists.editSetlist")}
          onPress={() => {
            setMenuOpen(false)
            router.push(`/setlists/${setlist.id}/edit`)
          }}
        />
        <SheetOptionRow
          label={t("setlists.duplicate")}
          onPress={() => {
            setMenuOpen(false)
            void duplicate()
          }}
        />
        {setlist.template ? (
          <SheetOptionRow
            label={t("setlists.removeFromTemplates")}
            onPress={() => {
              setMenuOpen(false)
              void dropTemplate()
            }}
          />
        ) : (
          <SheetOptionRow
            label={t("setlists.saveAsTemplate")}
            hint={t("setlists.saveAsTemplateHint")}
            onPress={() => {
              setMenuOpen(false)
              setTemplateName(setlist.name)
              setSavingTemplate(true)
            }}
          />
        )}
        <SheetOptionRow
          label={t("setlists.print")}
          onPress={() => {
            setMenuOpen(false)
            setPrintOpen(true)
          }}
        />
        <SheetOptionRow
          label={t("setlists.share")}
          hint={t("setlists.shareHint")}
          onPress={() => {
            setMenuOpen(false)
            setShareOpen(true)
          }}
        />
        {/* The band's own link to this setlist (#76): opens the app when it is
            installed, the web app when it is not. */}
        <SheetOptionRow
          label={t("deepLinks.copyLink")}
          hint={t("deepLinks.copyHint")}
          onPress={() => {
            setMenuOpen(false)
            void copyDeepLink("setlist", setlist.id, setlist.name)
          }}
        />
        <SheetOptionRow
          label={t("setlists.deleteSetlist")}
          onPress={() => {
            setMenuOpen(false)
            setConfirmDelete(true)
          }}
        />
      </BottomSheet>

      <PrintSheet
        visible={printOpen}
        onClose={() => setPrintOpen(false)}
        title={setlist.name}
        render={(options) => setlistPrintHtml(setlist.name, printableSongs, options)}
      />

      <ShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        kind="setlist"
        organizationId={setlist.organizationId}
        sourceId={setlist.id}
        title={setlist.name}
      />

      {/* The repertoire assistant (roadmap #86): how long the set should be,
          and whether the draft joins the list or replaces it. */}
      <Dialog
        visible={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        title={t("setlists.assistantTitle")}
        description={t("setlists.assistantDescription")}
        confirmLabel={t("setlists.assistantSuggest")}
        onConfirm={applyAssistant}
      >
        <View style={styles.assistantBody}>
          <Input
            label={t("setlists.assistantMinutes")}
            value={assistantMinutes}
            onChangeText={setAssistantMinutes}
            placeholder={`${ASSISTANT_DEFAULT_MINUTES}`}
            keyboardType="numeric"
          />
          <View style={styles.assistantChips}>
            <Chip
              label={t("setlists.assistantAdd")}
              selected={assistantMode === "add"}
              onPress={() => setAssistantMode("add")}
              accessibilityLabel={t("setlists.assistantAdd")}
            />
            <Chip
              label={t("setlists.assistantReplace")}
              selected={assistantMode === "replace"}
              onPress={() => setAssistantMode("replace")}
              accessibilityLabel={t("setlists.assistantReplace")}
            />
          </View>
        </View>
      </Dialog>

      <Dialog
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t("setlists.addSongs")}
        hideActions
        bodyScroll={false}
      >
        <SearchInput
          label={t("setlists.searchSongs")}
          placeholder={t("setlists.searchPlaceholder")}
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch("")}
        />
        {hasRetired || rotation.length > 0 || rotationOnly ? (
          <View style={styles.pickerChips}>
            {rotation.length > 0 || rotationOnly ? (
              <Chip
                label={t("setlists.rotationChip", { count: ROTATION_MISSED_EVENTS })}
                selected={rotationOnly}
                onPress={() => setRotationOnly((value) => !value)}
                accessibilityLabel={t("setlists.rotationChip", { count: ROTATION_MISSED_EVENTS })}
              />
            ) : null}
            {hasRetired ? (
              <Chip
                label={t("setlists.includeRetired")}
                selected={showRetired}
                onPress={() => setShowRetired((value) => !value)}
                accessibilityLabel={t("setlists.includeRetired")}
              />
            ) : null}
          </View>
        ) : null}
        <FlatList
          data={candidates}
          keyExtractor={(item) => item.id}
          style={styles.pickerList}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <AppText variant="caption" tone="faint">
              {songs.length === 0
                ? t("setlists.songbookEmpty")
                : rotationOnly
                  ? t("setlists.rotationEmpty")
                  : t("setlists.noMoreSongs")}
            </AppText>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("setlists.addSongA11y", {
                title: item.title,
              })}
              onPress={() =>
                setKeyTarget({
                  songId: item.id,
                  title: item.title,
                  originalKey: item.key,
                  key: item.key,
                  mode: "add",
                })
              }
              style={({ pressed }) => [
                styles.pickerRow,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {item.title}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {pickerCaption(item.id, item.artist)}
                </AppText>
              </View>
              {showRetired && item.status === "retired" ? (
                <Badge label={t("songs.statusRetired")} tone="default" />
              ) : null}
              <Badge
                label={item.key ? displayKey(item.key, notation) : "—"}
                tone="accent"
              />
            </Pressable>
          )}
        />
        <Button
          label={t("common.done")}
          variant="secondary"
          onPress={() => setPickerOpen(false)}
        />
      </Dialog>

      <Dialog
        visible={savingTemplate}
        onClose={() => setSavingTemplate(false)}
        title={t("setlists.saveAsTemplate")}
        description={t("setlists.saveAsTemplateHint")}
        confirmLabel={t("common.save")}
        confirmDisabled={templateName.trim().length === 0}
        confirmLoading={busy}
        onConfirm={() => void saveTemplate()}
      >
        <Input
          label={t("setlists.templateName")}
          placeholder={t("setlists.templateNamePlaceholder")}
          value={templateName}
          onChangeText={setTemplateName}
          autoFocus
        />
      </Dialog>

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("setlists.deleteSetlistConfirm", { name: setlist.name })}
        description={t("setlists.deleteSetlistDescription")}
        confirmLabel={t("setlists.deleteSetlist")}
        tone="danger"
        confirmLoading={busy}
        onConfirm={() => void remove()}
      />

      <SetlistKeyDialog
        visible={keyTarget !== null}
        songTitle={keyTarget?.title ?? ""}
        originalKey={keyTarget?.originalKey ?? ""}
        value={keyTarget?.key ?? ""}
        onClose={() => setKeyTarget(null)}
        onSelect={pickKey}
      />

      <SetlistBlockDialog
        visible={blockTarget !== null}
        mode={blockTarget?.mode ?? "insert"}
        name={blockTarget?.name ?? ""}
        onChangeName={(name) =>
          setBlockTarget((current) =>
            current ? { ...current, name } : current,
          )
        }
        onClose={() => setBlockTarget(null)}
        onSubmit={submitBlock}
      />

      <SetlistNoteDialog
        visible={noteTarget !== null}
        title={noteTarget?.title ?? ""}
        note={noteTarget?.note ?? ""}
        onChangeNote={(note) =>
          setNoteTarget((current) => (current ? { ...current, note } : current))
        }
        onClose={() => setNoteTarget(null)}
        onSubmit={submitNote}
      />
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    notes: {
      gap: Theme.spacing.s,
      borderLeftWidth: 2,
      borderLeftColor: Theme.colors.primary,
      paddingLeft: Theme.spacing.m,
    },
    listCard: { overflow: "hidden", justifyContent: "center" },
    goal: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.m,
      paddingHorizontal: Theme.spacing.xs,
    },
    songRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.xs,
    },
    songDivider: { borderTopWidth: 1, borderTopColor: Theme.colors.borderSoft },
    /** A divider of the running order (roadmap #43): its label between rules. */
    blockRow: {
      paddingVertical: Theme.spacing.xs,
      paddingHorizontal: Theme.spacing.m,
    },
    blockLabelRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
    },
    blockLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: Theme.colors.borderSoft,
    },
    blockName: { flexShrink: 1 },
    blockActions: { flexDirection: "row", alignItems: "center" },
    /**
     * The thin "+" bar between songs while editing — the place a divider goes.
     * A sibling row (not a child of the song) so it never counts as content.
     */
    insertBar: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 3,
    },
    noteLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 2,
    },
    songMain: {
      flex: 1,
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.m,
      paddingLeft: Theme.spacing.l,
      paddingRight: Theme.spacing.l,
    },
    order: { width: 20, textAlign: "right" },
    keyBadge: {
      borderWidth: 1,
      borderColor: Theme.colors.accent,
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: 4,
      alignSelf: "center",
      marginRight: Theme.spacing.m,
    },
    rowActions: {
      flexDirection: "row",
      alignItems: "center",
      paddingRight: Theme.spacing.xs,
    },
    shows: { gap: Theme.spacing.xs },
    showLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
    },
    pressed: { opacity: 0.7 },
    pickerChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Theme.spacing.xs,
      marginVertical: Theme.spacing.xs,
    },
    assistantRow: { flexDirection: "row", gap: Theme.spacing.s },
    assistantBody: { gap: Theme.spacing.m },
    assistantChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Theme.spacing.xs,
    },
    pickerList: { maxHeight: 320, width: "100%", flexShrink: 1 },
    pickerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.m,
      borderBottomWidth: 1,
      borderBottomColor: Theme.colors.border,
    },
  })

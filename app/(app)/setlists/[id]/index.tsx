import React, { useMemo, useState } from "react"
import { FlatList, Pressable, StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState } from "@/components/ui/States"
import { SearchInput } from "@/components/ui/Input"
import { useToast } from "@/components/ui/Toast"
import { CloseIcon, DotsIcon, MusicIcon, PlusIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { SetlistKeyDialog } from "@/components/setlists/SetlistKeyDialog"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import {
  deleteSetlist,
  duplicateSetlist,
  setlistSongKeys,
  updateSetlist,
  updateSetlistSongKey,
} from "@/services/setlists"
import { toFriendlyError } from "@/services/errors"
import { filterSongs, EMPTY_FILTERS } from "@/libs/songSearch"
import type { RelativeDayLabels } from "@/libs/format"
import {
  formatDateRange,
  formatDuration,
  formatDurationLong,
  formatRelativeDay,
} from "@/libs/format"
import { parseIsoDate } from "@/libs/validation"
import { estimateDurationSec } from "@/libs/songUtils"
import { displayKey } from "@/libs/chords"
import { usePreferences } from "@/services/prefs"

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
  const params = useLocalSearchParams<{ id?: string }>()
  const setlistId = params.id ?? null

  const { profile } = useAuth()
  const { organizationId, isAdmin } = useOrganization()
  const { setlists, songs, songLibrary, performances } = useOrgData()
  // Keys are stored in letters; the reader settings decide how they are spelled.
  const notation = usePreferences().chordNotation ?? "letters"

  const [editing, setEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  // Song whose play key is being chosen, and whether it is being added from
  // the picker or changed from the running order.
  const [keyTarget, setKeyTarget] = useState<{
    songId: string
    title: string
    originalKey: string
    key: string
    mode: "add" | "edit"
  } | null>(null)

  const setlist = useMemo(
    () => setlists.find((entry) => entry.id === setlistId) ?? null,
    [setlists, setlistId],
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

  const persistOrder = async (
    songIds: string[],
    songKeys: Record<string, string>,
  ): Promise<void> => {
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
          songIds,
          songKeys,
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
    void persistOrder(ids, setlistSongKeys(setlist.songs))
  }

  const removeSong = (songId: string): void => {
    if (!setlist) return
    void persistOrder(
      setlist.songs
        .filter((entry) => entry.songId !== songId)
        .map((entry) => entry.songId),
      setlistSongKeys(setlist.songs),
    )
  }

  const addSongs = (ids: string[], keys: Record<string, string> = {}): void => {
    if (!setlist || ids.length === 0) {
      setPickerOpen(false)
      return
    }
    const existing = setlist.songs.map((entry) => entry.songId)
    void persistOrder([...existing, ...ids], {
      ...setlistSongKeys(setlist.songs),
      ...keys,
    })
    setPickerOpen(false)
    setSearch("")
    toast.showSuccess(t("setlists.songsAdded", { count: ids.length }))
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
        "copy",
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

  const candidates = filterSongs(songs, { ...EMPTY_FILTERS, search }).filter(
    (song) => !setlist.songs.some((entry) => entry.songId === song.id),
  )
  const runsLabel = t("setlists.songsCount", {
    count: setlist.songs.length,
    duration: formatDurationLong(setlist.estimatedDurationSec),
  })
  const dateLabel = setlist.date
    ? formatRelativeDay(parseIsoDate(setlist.date), dayLabels)
    : ""
  const hasNotes =
    setlist.description.trim().length > 0 || setlist.notes.trim().length > 0

  return (
    <ScreenContainer
      back
      title={setlist.name}
      subtitle={[dateLabel, runsLabel].filter(Boolean).join(" · ")}
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
          {setlist.songs.map((entry, index) => {
            const song = songLibrary.get(entry.songId)
            const seconds = song
              ? (song.durationSec ?? estimateDurationSec(song.sections))
              : null
            return (
              <View
                key={`${entry.songId}-${index}`}
                style={[styles.songRow, index > 0 && styles.songDivider]}
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
                    {index + 1}
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
                      label={t("setlists.removeFromSetlist")}
                      size={30}
                      onPress={() => removeSong(entry.songId)}
                      icon={<CloseIcon size={15} color={Theme.colors.danger} />}
                    />
                  </View>
                ) : null}
              </View>
            )
          })}
        </Card>
      )}

      {isAdmin && editing ? (
        <Button
          label={t("setlists.addSongs")}
          icon={<PlusIcon size={16} color={Theme.colors.onPrimary} />}
          onPress={() => setPickerOpen(true)}
        />
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
        <SheetOptionRow
          label={t("setlists.deleteSetlist")}
          onPress={() => {
            setMenuOpen(false)
            setConfirmDelete(true)
          }}
        />
      </BottomSheet>

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
        <FlatList
          data={candidates}
          keyExtractor={(item) => item.id}
          style={styles.pickerList}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <AppText variant="caption" tone="faint">
              {songs.length === 0
                ? t("setlists.songbookEmpty")
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
                  {item.artist || t("common.unknownArtist")}
                </AppText>
              </View>
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
    songRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.xs,
    },
    songDivider: { borderTopWidth: 1, borderTopColor: Theme.colors.borderSoft },
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

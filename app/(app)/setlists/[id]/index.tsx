import React, { useMemo, useState } from "react"
import { FlatList, Pressable, StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card, Section } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState } from "@/components/ui/States"
import { SearchInput } from "@/components/ui/Input"
import { useToast } from "@/components/ui/Toast"
import {
  CloseIcon,
  CopyListIcon,
  EditIcon,
  MusicIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { deleteSetlist, duplicateSetlist, updateSetlist } from "@/services/setlists"
import { toFriendlyError } from "@/services/errors"
import { filterSongs, EMPTY_FILTERS } from "@/libs/songSearch"
import type { RelativeDayLabels } from "@/libs/format"
import { formatDateRange, formatDuration, formatDurationLong, formatRelativeDay } from "@/libs/format"
import { parseIsoDate } from "@/libs/validation"
import { estimateDurationSec } from "@/libs/songUtils"
import { PERFORMANCE_STATUS_TONES } from "@/components/performances/PerformanceCard"

/**
 * Setlist detail (docs §20): the running order with move up/down, an add-song
 * picker, a running duration and admin actions.
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

  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

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
  const actor = { id: profile?.uid ?? "", name: profile?.displayName || "An admin" }

  const persistOrder = async (songIds: string[]): Promise<void> => {
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
    void persistOrder(ids)
  }

  const removeSong = (songId: string): void => {
    if (!setlist) return
    void persistOrder(setlist.songs.filter((entry) => entry.songId !== songId).map((entry) => entry.songId))
  }

  const addSongs = (ids: string[]): void => {
    if (!setlist || ids.length === 0) {
      setPickerOpen(false)
      return
    }
    const existing = setlist.songs.map((entry) => entry.songId)
    void persistOrder([...existing, ...ids])
    setPickerOpen(false)
    setSearch("")
    toast.showSuccess(t("setlists.songsAdded", { count: ids.length }))
  }

  const duplicate = async (): Promise<void> => {
    if (!setlist) return
    setBusy(true)
    try {
      const id = await duplicateSetlist(organizationId ?? "", setlist.id, "copy", actor)
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
        <EmptyState title={t("setlists.setlistNotFound")} message={t("setlists.pickOne")} />
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

  return (
    <ScreenContainer
      back
      title={setlist.name}
      subtitle={
        setlist.date
          ? formatRelativeDay(parseIsoDate(setlist.date), dayLabels)
          : t("organizations.songsCount", { count: setlist.songs.length })
      }
      large
      headerRight={
        <View style={styles.headerActions}>
          {isAdmin ? (
            <>
              <IconButton
                label={t("setlists.editSetlist")}
                onPress={() => router.push(`/setlists/${setlist.id}/edit`)}
                icon={<EditIcon size={18} color={Theme.colors.textMuted} />}
              />
              <IconButton
                label={t("setlists.duplicate")}
                onPress={() => void duplicate()}
                icon={<CopyListIcon size={18} color={Theme.colors.textMuted} />}
              />
              <IconButton
                label={t("setlists.deleteSetlist")}
                variant="danger"
                onPress={() => setConfirmDelete(true)}
                icon={<TrashIcon size={18} color={Theme.colors.danger} />}
              />
            </>
          ) : null}
        </View>
      }
      toolbar={
        <Card style={styles.summary}>
          <View style={styles.summaryRow}>
            <View style={styles.flex}>
              <AppText variant="caption" tone="faint">
                {t("setlists.runningTime")}
              </AppText>
              <AppText variant="subheading">{formatDurationLong(setlist.estimatedDurationSec)}</AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="caption" tone="faint">
                {t("setlists.songs")}
              </AppText>
              <AppText variant="subheading">{setlist.songs.length}</AppText>
            </View>
          </View>
          {setlist.description.trim().length > 0 ? (
            <AppText variant="body" tone="muted">
              {setlist.description}
            </AppText>
          ) : null}
          {setlist.notes.trim().length > 0 ? (
            <AppText variant="caption" tone="muted">
              {setlist.notes}
            </AppText>
          ) : null}
        </Card>
      }
    >
      <Section title={t("setlists.usedInShows")}>
        {relatedShows.length === 0 ? (
          <AppText variant="caption" tone="faint">
            {t("setlists.noShowsYet")}
          </AppText>
        ) : (
          relatedShows.slice(0, 4).map((performance) => (
            <Card
              key={performance.id}
              onPress={() => router.push(`/performances/${performance.id}`)}
              style={styles.showRow}
            >
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {performance.name}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {formatDateRange(performance.date, performance.endDate, i18n.language)}
                </AppText>
              </View>
              <Badge
                label={t(`performances.${performance.status}`)}
                tone={PERFORMANCE_STATUS_TONES[performance.status]}
              />
            </Card>
          ))
        )}
      </Section>

      {setlist.songs.length === 0 ? (
        <EmptyState
          icon={<MusicIcon size={24} color={Theme.colors.primary} />}
          title={t("setlists.noSongsYet")}
          message={t("setlists.addSongsHint")}
          actionLabel={isAdmin ? t("setlists.addSongs") : undefined}
          onAction={isAdmin ? () => setPickerOpen(true) : undefined}
        />
      ) : (
        <View style={styles.list}>
          {setlist.songs.map((entry, index) => {
            const song = songLibrary.get(entry.songId)
            const seconds = song ? (song.durationSec ?? estimateDurationSec(song.sections)) : null
            return (
              <Card key={`${entry.songId}-${index}`} padded={false} style={styles.songCard}>
                <View style={styles.songRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("setlists.openSong", { title: entry.title })}
                    onPress={() => router.push(`/songs/${entry.songId}`)}
                    style={styles.songMain}
                  >
                    <AppText variant="caption" tone="faint" style={styles.order}>
                      {index + 1}
                    </AppText>
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {entry.title}
                      </AppText>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>
                        {[entry.artist || t("common.unknownArtist"), entry.key, formatDuration(seconds)]
                          .filter(Boolean)
                          .join(" · ")}
                      </AppText>
                    </View>
                  </Pressable>

                  {isAdmin ? (
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
                            tone={index === setlist.songs.length - 1 ? "faint" : "muted"}
                          >
                            ↓
                          </AppText>
                        }
                      />
                      <IconButton
                        label={t("setlists.removeFromSetlist")}
                        size={30}
                        onPress={() => removeSong(entry.songId)}
                        icon={<CloseIcon size={16} color={Theme.colors.danger} />}
                      />
                    </View>
                  ) : null}
                </View>
              </Card>
            )
          })}
        </View>
      )}

      {isAdmin ? (
        <Button
          label={t("setlists.addSongs")}
          icon={<PlusIcon size={16} color={Theme.colors.onPrimary} />}
          onPress={() => setPickerOpen(true)}
        />
      ) : null}

      <Dialog
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t("setlists.addSongs")}
        hideActions
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
              {songs.length === 0 ? t("setlists.songbookEmpty") : t("setlists.noMoreSongs")}
            </AppText>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("setlists.addSongA11y", { title: item.title })}
              onPress={() => addSongs([item.id])}
              style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}
            >
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {item.title}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {item.artist || t("common.unknownArtist")}
                </AppText>
              </View>
              <Badge label={item.key || "—"} tone="accent" />
            </Pressable>
          )}
        />
        <Button label={t("common.done")} variant="secondary" onPress={() => setPickerOpen(false)} />
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
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
    summary: { gap: Theme.spacing.s },
    summaryRow: { flexDirection: "row", gap: Theme.spacing.l },
    flex: { flex: 1, minWidth: 0 },
    showRow: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    list: { gap: Theme.spacing.m },
    songCard: { overflow: "hidden" },
    songRow: { flexDirection: "row", alignItems: "center" },
    songMain: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m, padding: Theme.spacing.m, flex: 1 },
    order: {
      width: 24,
      textAlign: "center",
      paddingVertical: 3,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.surfaceHigh,
      overflow: "hidden",
    },
    rowActions: { flexDirection: "row", alignItems: "center", paddingRight: Theme.spacing.xs },
    pickerList: { maxHeight: 320, width: "100%" },
    pickerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.m,
      borderBottomWidth: 1,
      borderBottomColor: Theme.colors.border,
    },
    pressed: { opacity: 0.7 },
  })
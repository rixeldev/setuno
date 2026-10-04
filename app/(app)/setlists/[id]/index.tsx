import React, { useMemo, useState } from "react"
import { FlatList, Pressable, StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card } from "@/components/ui/Card"
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
import { formatDuration, formatDurationLong, formatRelativeDay, pluralize } from "@/libs/format"
import { parseIsoDate } from "@/libs/validation"
import { estimateDurationSec } from "@/libs/songUtils"

/**
 * Setlist detail (docs §20): the running order with move up/down, an add-song
 * picker, a running duration and admin actions.
 */
export default function SetlistDetail() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const params = useLocalSearchParams<{ id?: string }>()
  const setlistId = params.id ?? null

  const { profile } = useAuth()
  const { organizationId, isAdmin } = useOrganization()
  const { setlists, songs, songLibrary } = useOrgData()

  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const setlist = useMemo(
    () => setlists.find((entry) => entry.id === setlistId) ?? null,
    [setlists, setlistId],
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
      toast.showError(toFriendlyError(error, "We couldn't update the running order."))
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
    toast.showSuccess(`${pluralize(ids.length, "song")} added.`)
  }

  const duplicate = async (): Promise<void> => {
    if (!setlist) return
    setBusy(true)
    try {
      const id = await duplicateSetlist(organizationId ?? "", setlist.id, "copy", actor)
      toast.showSuccess("Setlist duplicated.")
      router.replace(`/setlists/${id}`)
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't duplicate that setlist."))
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
      toast.showSuccess(`"${setlist.name}" was deleted.`)
      router.replace("/setlists")
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't delete that setlist."))
    } finally {
      setBusy(false)
    }
  }

  if (!setlistId) {
    return (
      <ScreenContainer back title="Setlist">
        <EmptyState title="Setlist not found" message="Pick one from the setlists screen." />
      </ScreenContainer>
    )
  }

  if (!setlist) {
    return (
      <ScreenContainer back title="Setlist">
        <EmptyState
          title="Setlist not found"
          message="It may have been deleted, or you may not have access to this band."
          actionLabel="Back to setlists"
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
        setlist.date ? formatRelativeDay(parseIsoDate(setlist.date)) : pluralize(setlist.songs.length, "song")
      }
      large
      headerRight={
        <View style={styles.headerActions}>
          {isAdmin ? (
            <>
              <IconButton
                label="Edit setlist"
                onPress={() => router.push(`/setlists/${setlist.id}/edit`)}
                icon={<EditIcon size={18} color={Theme.colors.textMuted} />}
              />
              <IconButton
                label="Duplicate setlist"
                onPress={() => void duplicate()}
                icon={<CopyListIcon size={18} color={Theme.colors.textMuted} />}
              />
              <IconButton
                label="Delete setlist"
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
                Running time
              </AppText>
              <AppText variant="subheading">{formatDurationLong(setlist.estimatedDurationSec)}</AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="caption" tone="faint">
                Songs
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
      {setlist.songs.length === 0 ? (
        <EmptyState
          icon={<MusicIcon size={24} color={Theme.colors.primary} />}
          title="No songs yet"
          message="Add the songs you plan to play, in order."
          actionLabel={isAdmin ? "Add songs" : undefined}
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
                    accessibilityLabel={`Open ${entry.title}`}
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
                        {[entry.artist || "Unknown artist", entry.key, formatDuration(seconds)]
                          .filter(Boolean)
                          .join(" · ")}
                      </AppText>
                    </View>
                  </Pressable>

                  {isAdmin ? (
                    <View style={styles.rowActions}>
                      <IconButton
                        label={`Move ${entry.title} up`}
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
                        label={`Move ${entry.title} down`}
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
                        label={`Remove ${entry.title}`}
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
          label="Add songs"
          icon={<PlusIcon size={16} color={Theme.colors.onPrimary} />}
          onPress={() => setPickerOpen(true)}
        />
      ) : null}

      <Dialog visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Add songs" hideActions>
        <SearchInput
          label="Search the songbook"
          placeholder="Title or artist"
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
              {songs.length === 0 ? "Your songbook is empty." : "No more songs to add."}
            </AppText>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.title}`}
              onPress={() => addSongs([item.id])}
              style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}
            >
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {item.title}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {item.artist || "Unknown artist"}
                </AppText>
              </View>
              <Badge label={item.key || "—"} tone="accent" />
            </Pressable>
          )}
        />
        <Button label="Done" variant="secondary" onPress={() => setPickerOpen(false)} />
      </Dialog>

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete "${setlist.name}"?`}
        description="The running order is removed. The songs themselves stay in the songbook."
        confirmLabel="Delete setlist"
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
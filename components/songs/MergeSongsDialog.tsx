import React, { useMemo, useState } from "react"
import { FlatList, Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Chip } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { SearchInput } from "@/components/ui/Input"
import { EMPTY_FILTERS, filterSongs } from "@/libs/songSearch"
import { mergeCandidates, mergeCounts } from "@/libs/songMerge"
import type { Setlist, Song, SongSuggestion } from "@/interfaces"

/**
 * The merge assistant (roadmap #32) as one dialog in two phases: pick the other
 * song — the #39 duplicate matcher's hits ranked first, tagged "Same title" —
 * then choose which of the two survives and confirm the destructive step with
 * the exact counts of what will move.
 *
 * Mount it only while the sheet is open: every open starts back at the picker,
 * so no phase/search/direction state ever needs resetting in an effect.
 */
export interface MergeSongsDialogProps {
  visible: boolean
  /** The song the reader is showing — one of the two being merged. */
  current: Song
  songs: Song[]
  setlists: Setlist[]
  suggestions: SongSuggestion[]
  onClose: () => void
  /** Runs the merge; keeps its spinner until it resolves or throws. */
  onMerge: (masterId: string, loserId: string) => Promise<void>
}

export function MergeSongsDialog({
  visible,
  current,
  songs,
  setlists,
  suggestions,
  onClose,
  onMerge,
}: MergeSongsDialogProps) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const [phase, setPhase] = useState<"pick" | "confirm">("pick")
  const [search, setSearch] = useState("")
  const [target, setTarget] = useState<Song | null>(null)
  const [keepCurrent, setKeepCurrent] = useState(true)
  const [busy, setBusy] = useState(false)

  const candidates = useMemo(
    () => mergeCandidates(filterSongs(songs, { ...EMPTY_FILTERS, search }), current),
    [songs, search, current],
  )

  const loser = target ? (keepCurrent ? target : current) : null
  const counts = loser ? mergeCounts(setlists, suggestions, loser.id) : null
  const refsLabel =
    counts && counts.setlists + counts.suggestions > 0
      ? [
          counts.setlists > 0 ? t("songs.mergeSetlistsCount", { count: counts.setlists }) : null,
          counts.suggestions > 0
            ? t("songs.mergeSuggestionsCount", { count: counts.suggestions })
            : null,
        ]
          .filter((part): part is string => part !== null)
          .join(" · ")
      : t("songs.mergeNoRefs")

  const pick = (song: Song): void => {
    setTarget(song)
    setKeepCurrent(true)
    setPhase("confirm")
  }

  const run = async (): Promise<void> => {
    if (!target || busy) return
    setBusy(true)
    try {
      await onMerge(keepCurrent ? current.id : target.id, keepCurrent ? target.id : current.id)
    } catch {
      // The caller already showed the error; stay open on the same choice so
      // the merge can simply be retried. On success it closes the dialog and
      // this component unmounts, so nothing is reset here.
      setBusy(false)
    }
  }

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={phase === "pick" ? t("songs.mergePickTitle") : t("songs.mergeConfirmTitle")}
      {...(phase === "pick"
        ? { hideActions: true, bodyScroll: false }
        : {
            confirmLabel: t("songs.mergeAction"),
            tone: "danger" as const,
            confirmLoading: busy,
            onConfirm: () => void run(),
          })}
    >
      {phase === "pick" ? (
        <>
          <AppText variant="caption" tone="muted">
            {t("songs.mergePickHint", { title: current.title })}
          </AppText>
          <SearchInput
            placeholder={t("songs.searchPlaceholder")}
            value={search}
            onChangeText={setSearch}
            onClear={() => setSearch("")}
          />
          <FlatList
            data={candidates}
            keyExtractor={(item) => item.song.id}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <AppText variant="caption" tone="faint">
                {songs.length <= 1 ? t("songs.mergeNoOther") : t("songs.noResults")}
              </AppText>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("songs.mergePickA11y", { title: item.song.title })}
                onPress={() => pick(item.song)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowText}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {item.song.title}
                  </AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {item.song.artist}
                  </AppText>
                </View>
                {item.sameTitle ? (
                  <Chip label={t("songs.mergeSameTitle")} tone="accent" size="sm" />
                ) : null}
              </Pressable>
            )}
          />
        </>
      ) : (
        loser && (
          <>
            <AppText variant="caption" tone="muted">
              {t("songs.mergeKeepHint")}
            </AppText>

            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: keepCurrent }}
              accessibilityLabel={t("songs.mergeKeep", { title: current.title })}
              onPress={() => setKeepCurrent(true)}
              style={({ pressed }) => [
                styles.choice,
                keepCurrent && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.radio, keepCurrent && styles.radioSelected]}>
                {keepCurrent ? <View style={styles.radioDot} /> : null}
              </View>
              <AppText variant="body" numberOfLines={2} style={styles.choiceText}>
                {t("songs.mergeKeep", { title: current.title })}
              </AppText>
            </Pressable>

            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: !keepCurrent }}
              accessibilityLabel={t("songs.mergeKeep", { title: target?.title ?? "" })}
              onPress={() => setKeepCurrent(false)}
              style={({ pressed }) => [
                styles.choice,
                !keepCurrent && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.radio, !keepCurrent && styles.radioSelected]}>
                {!keepCurrent ? <View style={styles.radioDot} /> : null}
              </View>
              <AppText variant="body" numberOfLines={2} style={styles.choiceText}>
                {t("songs.mergeKeep", { title: target?.title ?? "" })}
              </AppText>
            </Pressable>

            <AppText variant="caption" tone="muted">
              {refsLabel}
            </AppText>
            <AppText variant="caption" tone="danger">
              {t("songs.mergeDeletes", { title: loser.title })}
            </AppText>
          </>
        )
      )}
    </Dialog>
  )
}

const createStyles = () =>
  StyleSheet.create({
    list: { maxHeight: 320, width: "100%", flexShrink: 1 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      paddingVertical: Theme.spacing.s,
      paddingHorizontal: Theme.spacing.xs,
      borderRadius: Theme.radii.s,
      // Defined from the start so Android never paints a pressed/rounded state
      // as a square (the platform paints the background once, at mount).
      backgroundColor: Theme.colors.transparent,
    },
    rowText: { flex: 1, minWidth: 0, gap: 2 },
    pressed: { backgroundColor: Theme.colors.surfaceHigh },
    choice: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      padding: Theme.spacing.s,
      borderRadius: Theme.radii.s,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.transparent,
    },
    choiceSelected: {
      borderColor: Theme.colors.accent,
      backgroundColor: Theme.colors.accentSoft,
    },
    choiceText: { flex: 1, minWidth: 0 },
    radio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: Theme.colors.textFaint,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.transparent,
    },
    radioSelected: { borderColor: Theme.colors.accent },
    radioDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Theme.colors.accent,
    },
  })

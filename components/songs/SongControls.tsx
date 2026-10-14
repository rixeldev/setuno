import React from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { IconButton } from "@/components/ui/Button"
import { Chip } from "@/components/ui/Card"
import { useResponsive } from "@/hooks/useResponsive"
import { MusicIcon, RefreshIcon } from "@/components/ui/Icons"
import { READER_FONT_MAX, READER_FONT_MIN } from "@/libs/readerState"
import type { ChordNotation, ChordView } from "@/interfaces"

interface SongControlsProps {
  /** Semitone shift currently applied to the displayed chords. */
  semitones: number
  onSemitonesChange: (semitones: number) => void
  /** Transposed key label, e.g. "A" for a song written in G, up 2. */
  displayKey: string
  originalKey: string
  capo: number
  onCapoChange: (capo: number) => void
  fontSize: number
  onFontSizeChange: (fontSize: number) => void
  /** Reader layout: chords above the lyrics ("both"), lyrics only or a chart. */
  view: ChordView
  onViewChange: (view: ChordView) => void
  /** Chord spelling: letters (C), solfège (Do) or Nashville (1 4 5). */
  notation: ChordNotation
  onNotationChange: (notation: ChordNotation) => void
  /** True while there is something to undo: a transposition, capo or resume point. */
  canResetView: boolean
  /** One tap back to the song's own key, no capo and the top of the lyrics. */
  onResetView: () => void
}

const MIN_FONT = READER_FONT_MIN
const MAX_FONT = READER_FONT_MAX
/** Touch-friendly size that still lets four groups share one phone row. */
const STEP_SIZE = 28

/** The three notations a tap on the chip cycles through, in order. */
const NOTATION_ORDER: ChordNotation[] = ["letters", "solfege", "nashville"]
/** The three reader layouts a tap on the view chip cycles through, in order. */
const VIEW_ORDER: ChordView[] = ["both", "lyrics", "chords"]

const nextOf = <T,>(order: readonly T[], current: T): T => {
  const index = order.indexOf(current)
  return order[(index + 1) % order.length] as T
}

/**
 * Performance controls of the song reader: transpose, capo, text size and the
 * chord layout, with the notation toggle sitting next to the key it affects.
 * Transposition is display-only, the saved song never changes.
 *
 * The four groups lay out in a compact grid that always fits the screen — on
 * very narrow devices they wrap to a second row instead of hiding behind a
 * horizontal scroll.
 */
export function SongControls({
  semitones,
  onSemitonesChange,
  displayKey,
  originalKey,
  capo,
  onCapoChange,
  fontSize,
  onFontSizeChange,
  view,
  onViewChange,
  notation,
  onNotationChange,
  canResetView,
  onResetView,
}: SongControlsProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { gutter, contentMaxWidth } = useResponsive()

  return (
    <View style={[styles.host, { paddingHorizontal: gutter }]}>
      <View style={[styles.inner, { maxWidth: contentMaxWidth }]}>
        <View style={styles.keyRow}>
          <View style={styles.keyInfo}>
            <MusicIcon size={15} color={Theme.colors.primary} />
            <AppText variant="subheading" tone="primary">
              {displayKey || "—"}
            </AppText>
            {semitones !== 0 ? (
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {t("songs.keyWas", { key: originalKey })}
              </AppText>
            ) : null}
            {capo > 0 ? (
              <AppText variant="caption" tone="faint" numberOfLines={1}>
                {t("songs.capoShort", { capo })}
              </AppText>
            ) : null}
          </View>

          <Chip
            label={
              notation === "letters"
                ? t("songs.notationLetters")
                : notation === "solfege"
                  ? t("songs.notationSolfege")
                  : t("songs.notationNashville")
            }
            tone="primary"
            selected
            onPress={() => onNotationChange(nextOf(NOTATION_ORDER, notation))}
            accessibilityLabel={t("songs.switchNotation")}
          />
        </View>

        <View style={styles.groups}>
          <View style={styles.group}>
            <AppText variant="caption" tone="faint" style={styles.groupLabel}>
              {t("songs.key")}
            </AppText>
            <View style={styles.stepper}>
              <IconButton
                label={t("songs.transposeDownA11y")}
                variant="secondary"
                size={STEP_SIZE}
                onPress={() => onSemitonesChange(clampSemitones(semitones - 1))}
                icon={<AppText variant="bodyStrong">−</AppText>}
              />
              <AppText variant="caption" tone="muted" style={styles.stepperValue}>
                {semitones > 0 ? `+${semitones}` : semitones}
              </AppText>
              <IconButton
                label={t("songs.transposeUpA11y")}
                variant="secondary"
                size={STEP_SIZE}
                onPress={() => onSemitonesChange(clampSemitones(semitones + 1))}
                icon={<AppText variant="bodyStrong">+</AppText>}
              />
            </View>
          </View>

          <View style={styles.group}>
            <AppText variant="caption" tone="faint" style={styles.groupLabel}>
              {t("songs.capo")}
            </AppText>
            <View style={styles.stepper}>
              <IconButton
                label={t("songs.lowerCapo")}
                variant="secondary"
                size={STEP_SIZE}
                disabled={capo <= 0}
                onPress={() => onCapoChange(Math.max(0, capo - 1))}
                icon={<AppText variant="bodyStrong">−</AppText>}
              />
              <AppText variant="caption" tone="muted" style={styles.stepperValue}>
                {capo}
              </AppText>
              <IconButton
                label={t("songs.raiseCapo")}
                variant="secondary"
                size={STEP_SIZE}
                disabled={capo >= 12}
                onPress={() => onCapoChange(Math.min(12, capo + 1))}
                icon={<AppText variant="bodyStrong">+</AppText>}
              />
            </View>
          </View>

          <View style={styles.group}>
            <AppText variant="caption" tone="faint" style={styles.groupLabel}>
              {t("songs.text")}
            </AppText>
            <View style={styles.stepper}>
              <IconButton
                label={t("songs.smallerText")}
                variant="secondary"
                size={STEP_SIZE}
                disabled={fontSize <= MIN_FONT}
                onPress={() => onFontSizeChange(Math.max(MIN_FONT, fontSize - 1))}
                icon={<AppText variant="bodyStrong">A</AppText>}
              />
              <IconButton
                label={t("songs.largerText")}
                variant="secondary"
                size={STEP_SIZE}
                disabled={fontSize >= MAX_FONT}
                onPress={() => onFontSizeChange(Math.min(MAX_FONT, fontSize + 1))}
                icon={<AppText variant="bodyStrong">A+</AppText>}
              />
            </View>
          </View>

          <View style={styles.group}>
            <AppText variant="caption" tone="faint" style={styles.groupLabel}>
              {t("songs.view")}
            </AppText>
            <View style={styles.stepper}>
              <Chip
                label={
                  view === "both"
                    ? t("songs.viewBoth")
                    : view === "lyrics"
                      ? t("songs.viewLyrics")
                      : t("songs.viewChords")
                }
                tone="primary"
                selected
                onPress={() => onViewChange(nextOf(VIEW_ORDER, view))}
                accessibilityLabel={t("songs.switchView")}
                style={styles.viewChip}
              />
              <IconButton
                label={t("songs.resetViewA11y")}
                variant="secondary"
                size={STEP_SIZE}
                disabled={!canResetView}
                onPress={onResetView}
                icon={<RefreshIcon size={15} color={Theme.colors.text} />}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

/** Keeps the transposition inside one octave (no "wrap around" surprises). */
const clampSemitones = (value: number): number => Math.max(-11, Math.min(11, value))

const createStyles = () =>
  StyleSheet.create({
    // No surface and no rules of its own: it renders inside the reader's bottom
    // tray, which paints the chrome and the divider.
    host: { paddingVertical: Theme.spacing.xs },
    inner: { width: "100%", alignSelf: "center", gap: Theme.spacing.s },
    keyRow: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    keyInfo: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
    },
    groups: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      columnGap: Theme.spacing.m,
      rowGap: Theme.spacing.s,
    },
    group: { alignItems: "center", gap: 4 },
    groupLabel: { letterSpacing: 0.8, textAlign: "center" },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Theme.spacing.xs,
    },
    stepperValue: { minWidth: 16, textAlign: "center" },
    /** Only the width: `Chip` already paints the pill and its primary tone. */
    viewChip: { minWidth: 76, justifyContent: "center" },
  })

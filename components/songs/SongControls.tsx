import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { IconButton } from "@/components/ui/Button"
import { useResponsive } from "@/hooks/useResponsive"
import { CollapseIcon, ExpandIcon, MusicIcon, RefreshIcon } from "@/components/ui/Icons"
import type { ChordNotation } from "@/interfaces"

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
  showChords: boolean
  onToggleChords: () => void
  /** Chord spelling preference: letters (C, F#m) or solfège (Do, Fa#m). */
  notation: ChordNotation
  onNotationChange: (notation: ChordNotation) => void
}

const MIN_FONT = 13
const MAX_FONT = 30
/** Touch-friendly size that still lets four groups share one phone row. */
const STEP_SIZE = 28

/**
 * Performance controls of the song reader: transpose, capo, text size and chord
 * visibility. Transposition is display-only, the saved song never changes.
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
  showChords,
  onToggleChords,
  notation,
  onNotationChange,
}: SongControlsProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { gutter, contentMaxWidth } = useResponsive()

  return (
    <View style={[styles.host, { paddingHorizontal: gutter }]}>
      <View style={[styles.inner, { maxWidth: contentMaxWidth }]}>
        <View style={styles.keyRow}>
          <MusicIcon size={15} color={Theme.colors.primary} />
          <AppText variant="subheading" tone="primary">
            {displayKey || "—"}
          </AppText>
          {semitones !== 0 ? (
            <AppText variant="caption" tone="muted">
              {t("songs.keyWas", { key: originalKey })}
            </AppText>
          ) : null}
          {capo > 0 ? (
            <AppText variant="caption" tone="faint">
              {t("songs.capoShort", { capo })}
            </AppText>
          ) : null}
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
              {t("songs.chords")}
            </AppText>
            <View style={styles.stepper}>
              <IconButton
                label={showChords ? t("songs.hideChords") : t("songs.showChords")}
                variant={showChords ? "secondary" : "ghost"}
                size={STEP_SIZE}
                onPress={onToggleChords}
                icon={
                  showChords ? (
                    <CollapseIcon size={15} color={Theme.colors.primary} />
                  ) : (
                    <ExpandIcon size={15} color={Theme.colors.textMuted} />
                  )
                }
              />
              <IconButton
                label={t("songs.resetTransposeA11y")}
                variant="secondary"
                size={STEP_SIZE}
                disabled={semitones === 0 && capo === 0}
                onPress={() => {
                  onSemitonesChange(0)
                  onCapoChange(0)
                }}
                icon={<RefreshIcon size={15} color={Theme.colors.text} />}
              />
            </View>
          </View>

          <View style={styles.group}>
            <AppText variant="caption" tone="faint" style={styles.groupLabel}>
              {t("songs.notation")}
            </AppText>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => onNotationChange(notation === "letters" ? "solfege" : "letters")}
                accessibilityRole="button"
                accessibilityLabel={t("songs.switchNotation")}
                accessibilityState={{ selected: notation === "solfege" }}
                style={({ pressed }) => [styles.notationChip, pressed && styles.pressed]}
              >
                <AppText variant="caption" tone="primary" numberOfLines={1}>
                  {notation === "letters" ? t("songs.notationLetters") : t("songs.notationSolfege")}
                </AppText>
              </Pressable>
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
    host: {
      paddingVertical: Theme.spacing.s,
      backgroundColor: Theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: Theme.colors.borderSoft,
    },
    inner: { width: "100%", alignSelf: "center", gap: Theme.spacing.m },
    keyRow: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
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
    notationChip: {
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: 5,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: Theme.colors.primary,
    },
    pressed: { opacity: 0.7 },
  })

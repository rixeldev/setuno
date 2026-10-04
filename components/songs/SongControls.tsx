import React from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { IconButton } from "@/components/ui/Button"
import { useResponsive } from "@/hooks/useResponsive"
import { CollapseIcon, ExpandIcon, MusicIcon, RefreshIcon } from "@/components/ui/Icons"
import { describeSemitones } from "@/libs/chords"

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
}

const MIN_FONT = 13
const MAX_FONT = 30

/**
 * Performance controls of the song reader: transpose, capo, text size and chord
 * visibility. Transposition is display-only, the saved song never changes.
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
}: SongControlsProps) {
  const styles = useThemedStyles(createStyles)
  const { gutter } = useResponsive()
  const soundingKey = capo > 0 ? displayKey : displayKey

  return (
    <View style={[styles.host, { paddingHorizontal: gutter }]}>
      <View style={styles.keyRow}>
        <View style={styles.keyBadge}>
          <MusicIcon size={15} color={Theme.colors.primary} />
          <AppText variant="subheading" tone="primary">
            {soundingKey || "—"}
          </AppText>
          {semitones !== 0 ? (
            <AppText variant="caption" tone="muted">
              was {originalKey}
            </AppText>
          ) : null}
          {capo > 0 ? (
            <AppText variant="caption" tone="faint">
              capo {capo}
            </AppText>
          ) : null}
        </View>
        <AppText variant="caption" tone="faint">
          {describeSemitones(semitones)}
        </AppText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.groups}
      >
        <View style={styles.group}>
          <AppText variant="caption" tone="faint" style={styles.groupLabel}>
            Key
          </AppText>
          <View style={styles.stepper}>
            <IconButton
              label="Transpose down one semitone"
              variant="secondary"
              size={34}
              onPress={() => onSemitonesChange(clampSemitones(semitones - 1))}
              icon={<AppText variant="bodyStrong">−</AppText>}
            />
            <AppText variant="caption" tone="muted" style={styles.stepperValue}>
              {semitones > 0 ? `+${semitones}` : semitones}
            </AppText>
            <IconButton
              label="Transpose up one semitone"
              variant="secondary"
              size={34}
              onPress={() => onSemitonesChange(clampSemitones(semitones + 1))}
              icon={<AppText variant="bodyStrong">+</AppText>}
            />
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.group}>
          <AppText variant="caption" tone="faint" style={styles.groupLabel}>
            Capo
          </AppText>
          <View style={styles.stepper}>
            <IconButton
              label="Lower capo"
              variant="secondary"
              size={34}
              disabled={capo <= 0}
              onPress={() => onCapoChange(Math.max(0, capo - 1))}
              icon={<AppText variant="bodyStrong">−</AppText>}
            />
            <AppText variant="caption" tone="muted" style={styles.stepperValue}>
              {capo}
            </AppText>
            <IconButton
              label="Raise capo"
              variant="secondary"
              size={34}
              disabled={capo >= 12}
              onPress={() => onCapoChange(Math.min(12, capo + 1))}
              icon={<AppText variant="bodyStrong">+</AppText>}
            />
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.group}>
          <AppText variant="caption" tone="faint" style={styles.groupLabel}>
            Text
          </AppText>
          <View style={styles.stepper}>
            <IconButton
              label="Smaller text"
              variant="secondary"
              size={34}
              disabled={fontSize <= MIN_FONT}
              onPress={() => onFontSizeChange(Math.max(MIN_FONT, fontSize - 1))}
              icon={<AppText variant="bodyStrong">A</AppText>}
            />
            <IconButton
              label="Larger text"
              variant="secondary"
              size={34}
              disabled={fontSize >= MAX_FONT}
              onPress={() => onFontSizeChange(Math.min(MAX_FONT, fontSize + 1))}
              icon={<AppText variant="bodyStrong">A+</AppText>}
            />
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.group}>
          <AppText variant="caption" tone="faint" style={styles.groupLabel}>
            Chords
          </AppText>
          <View style={styles.stepper}>
            <IconButton
              label={showChords ? "Hide chords" : "Show chords"}
              variant={showChords ? "secondary" : "ghost"}
              size={34}
              onPress={onToggleChords}
              icon={
                showChords ? (
                  <CollapseIcon size={16} color={Theme.colors.primary} />
                ) : (
                  <ExpandIcon size={16} color={Theme.colors.textMuted} />
                )
              }
            />
            <IconButton
              label="Reset transposition"
              variant="secondary"
              size={34}
              disabled={semitones === 0 && capo === 0}
              onPress={() => {
                onSemitonesChange(0)
                onCapoChange(0)
              }}
              icon={<RefreshIcon size={16} color={Theme.colors.text} />}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

/** Keeps the transposition inside one octave (no "wrap around" surprises). */
const clampSemitones = (value: number): number => Math.max(-11, Math.min(11, value))

/** Full-screen/immersive toggle used by the reader header. */
export function ImmersiveToggle({
  immersive,
  onToggle,
}: {
  immersive: boolean
  onToggle: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={immersive ? "Exit performance mode" : "Enter performance mode"}
      onPress={onToggle}
      hitSlop={Theme.hitSlop}
    >
      <AppText variant="caption" tone={immersive ? "primary" : "muted"}>
        {immersive ? "Exit stage" : "Stage mode"}
      </AppText>
    </Pressable>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: {
      gap: Theme.spacing.m,
      paddingHorizontal: Theme.spacing.l,
      paddingVertical: Theme.spacing.m,
      backgroundColor: Theme.colors.background2,
      borderBottomWidth: 1,
      borderBottomColor: Theme.colors.border,
    },
    keyRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.m,
    },
    keyBadge: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    groups: { alignItems: "center", gap: Theme.spacing.m },
    group: { gap: 4, alignItems: "flex-start" },
    groupLabel: { letterSpacing: 0.8 },
    stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
    stepperValue: { minWidth: 26, textAlign: "center" },
    divider: { width: 1, height: 42, backgroundColor: Theme.colors.border },
  })

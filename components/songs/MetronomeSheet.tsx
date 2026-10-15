import React from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button, IconButton } from "@/components/ui/Button"
import { Chip } from "@/components/ui/Card"
import { PauseIcon, PlayFilledIcon } from "@/components/ui/Icons"
import {
  BEATS_PER_MEASURE,
  measureLabel,
  type MetronomeBeat,
} from "@/libs/metronome"

interface MetronomeSheetProps {
  visible: boolean
  onClose: () => void
  bpm: number
  beatsPerMeasure: number
  accent: boolean
  countIn: boolean
  running: boolean
  /** Last beat fired — drives the dots and the count-in number (`null`: idle). */
  beat: MetronomeBeat | null
  onTap: () => void
  onBpmChange: (bpm: number) => void
  onBeatsPerMeasureChange: (beats: number) => void
  onAccentChange: (accent: boolean) => void
  onCountInChange: (countIn: boolean) => void
  onToggle: () => void
}

/**
 * The reader's metronome panel (roadmap #11): tempo, tap tempo, bar size,
 * accent and count-in, starting from the song's BPM. It is presentation only —
 * the transport lives in `useMetronome`, so closing the sheet never stops the
 * clicks and the dock's icon stays lit while a run is going.
 *
 * The display area keeps a fixed height in every state (idle dots, running
 * dots, count-in number), so the controls below it never jump under the
 * finger when the run starts.
 */
export function MetronomeSheet({
  visible,
  onClose,
  bpm,
  beatsPerMeasure,
  accent,
  countIn,
  running,
  beat,
  onTap,
  onBpmChange,
  onBeatsPerMeasureChange,
  onAccentChange,
  onCountInChange,
  onToggle,
}: MetronomeSheetProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("songs.metronome")}
      subtitle={t("songs.metronomeHint")}
    >
      <View style={styles.body}>
        <View style={styles.display}>
          {beat?.countIn ? (
            <AppText variant="display" tone="primary" style={styles.count}>
              {beat.withinMeasure + 1}
            </AppText>
          ) : null}
          <View
            style={styles.dots}
            // Decorative: the caption below carries the same information for
            // screen readers, which cannot perceive a filled circle.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            aria-hidden
          >
            {Array.from({ length: beatsPerMeasure }, (_, index) => {
              const active = running && beat !== null && beat.withinMeasure === index
              const downbeat = index === 0
              return (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    downbeat && styles.dotDownbeat,
                    active && styles.dotActive,
                    active && downbeat && styles.dotAccent,
                  ]}
                />
              )
            })}
          </View>
          <AppText variant="caption" tone="muted">
            {`${measureLabel(beatsPerMeasure)} · ${bpm} BPM`}
          </AppText>
        </View>

        <View style={styles.stepper}>
          <IconButton
            label={t("songs.metronomeSlower")}
            variant="secondary"
            size={36}
            onPress={() => onBpmChange(bpm - 1)}
            icon={<AppText variant="bodyStrong">−</AppText>}
          />
          <View style={styles.bpmBox}>
            <AppText variant="subheading">{bpm}</AppText>
            <AppText variant="caption" tone="faint">
              BPM
            </AppText>
          </View>
          <IconButton
            label={t("songs.metronomeFaster")}
            variant="secondary"
            size={36}
            onPress={() => onBpmChange(bpm + 1)}
            icon={<AppText variant="bodyStrong">+</AppText>}
          />
          <Button
            label={t("songs.metronomeTap")}
            variant="secondary"
            size="sm"
            onPress={onTap}
            style={styles.tap}
          />
        </View>

        <View style={styles.section}>
          <AppText variant="caption" tone="faint">
            {t("songs.metronomeBeats")}
          </AppText>
          <View style={styles.chips}>
            {BEATS_PER_MEASURE.map((beats) => (
              <Chip
                key={beats}
                label={measureLabel(beats)}
                size="sm"
                selected={beats === beatsPerMeasure}
                onPress={() => onBeatsPerMeasureChange(beats)}
              />
            ))}
          </View>
        </View>

        <View style={styles.chips}>
          <Chip
            label={t("songs.metronomeAccent")}
            tone="primary"
            selected={accent}
            onPress={() => onAccentChange(!accent)}
          />
          <Chip
            label={t("songs.metronomeCountIn")}
            tone="primary"
            selected={countIn}
            onPress={() => onCountInChange(!countIn)}
          />
        </View>

        <Button
          label={running ? t("songs.metronomeStop") : t("songs.metronomeStart")}
          variant={running ? "secondary" : "primary"}
          onPress={onToggle}
          icon={
            running ? (
              <PauseIcon size={16} color={Theme.colors.text} />
            ) : (
              <PlayFilledIcon size={16} color={Theme.colors.onPrimary} />
            )
          }
        />
      </View>
    </BottomSheet>
  )
}

const DOT_SIZE = 12
/** Every state of the display shares this box, so the sheet never reflows. */
const DISPLAY_HEIGHT = 104

const createStyles = () =>
  StyleSheet.create({
    body: { gap: Theme.spacing.m },
    display: {
      height: DISPLAY_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
      gap: Theme.spacing.xs,
    },
    // Sits in the display's own space; the dots below carry on for the rest of
    // the bar, so the count-in and the groove read from the same row.
    count: { fontSize: Theme.sizes.hero },
    dots: { flexDirection: "row", gap: Theme.spacing.xs },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      backgroundColor: Theme.colors.border,
    },
    // The downbeat is bigger, not just louder: the bar's shape is readable at
    // a glance even with the sound off.
    dotDownbeat: { width: DOT_SIZE + 4, height: DOT_SIZE + 4, borderRadius: (DOT_SIZE + 4) / 2 },
    dotActive: { backgroundColor: Theme.colors.textMuted },
    dotAccent: { backgroundColor: Theme.colors.primary },
    stepper: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    bpmBox: { alignItems: "center", minWidth: 72 },
    tap: { flex: 1, marginLeft: Theme.spacing.s },
    section: { gap: Theme.spacing.xs },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.xs },
  })

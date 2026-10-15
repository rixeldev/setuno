import React from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import type { TunerStreamStatus } from "@/interfaces/tuner"
import type { TunerReading } from "@/libs/tunerEngine"

/** Cents inside this band read as "in tune" — a hair tighter than a fret. */
const IN_TUNE_CENTS = 5
/** Inside this band the needle is "close" (warning colour), beyond it is wide. */
const NEAR_CENTS = 15

type TunerDisplayProps = {
  reading: TunerReading
  status: TunerStreamStatus
}

/**
 * The tuner spike's readout (roadmap #13): one huge note, one ±50-cent track
 * and the measured frequency. Everything is derived from the last reading —
 * the smoothing (median of five) and the decay hold live in the engine, so
 * this component never stabilises anything itself.
 */
export function TunerDisplay({ reading, status }: TunerDisplayProps) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)

  const cents = reading ? Math.round(reading.cents) : 0
  const inTune = reading !== null && Math.abs(reading.cents) <= IN_TUNE_CENTS
  const near = reading !== null && Math.abs(reading.cents) <= NEAR_CENTS
  // Resolved at render (the sanctioned pattern): TextTone has no "warning", so
  // the readout colour is painted through style instead of the tone prop.
  const readoutColor = inTune
    ? Theme.colors.success
    : near
      ? Theme.colors.warning
      : Theme.colors.textMuted
  const markerPosition = reading
    ? Math.min(97, Math.max(3, ((reading.cents + 50) / 100) * 100))
    : 50

  const stateLabel = !reading
    ? ""
    : inTune
      ? t("tuner.inTune")
      : cents > 0
        ? t("tuner.sharpWord")
        : t("tuner.flatWord")

  const accessibilityLabel = reading
    ? t("tuner.readoutA11y", {
        note: `${reading.name}${reading.octave}`,
        cents: Math.abs(cents),
        hertz: reading.frequency.toFixed(1),
        state: stateLabel,
      })
    : status === "running"
      ? t("tuner.playAStructure")
      : t("tuner.listening")

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel} accessibilityRole="text">
      <View style={styles.noteRow}>
        <AppText variant="display" tone={reading ? "default" : "faint"} style={styles.note}>
          {reading ? `${reading.name}${reading.octave}` : "—"}
        </AppText>
        <AppText variant="subheading" style={{ color: readoutColor }}>
          {!reading
            ? ""
            : inTune
              ? t("tuner.inTune")
              : cents > 0
                ? t("tuner.sharp", { cents: Math.abs(cents) })
                : t("tuner.flat", { cents: Math.abs(cents) })}
        </AppText>
      </View>

      <View style={styles.track} importantForAccessibility="no">
        <View style={styles.trackFill} />
        <View style={styles.centerTick} />
        <View
          style={[
            styles.marker,
            { left: `${markerPosition}%`, backgroundColor: readoutColor },
          ]}
        />
      </View>

      <AppText variant="mono" tone="muted" style={styles.measurement}>
        {reading
          ? t("tuner.measurement", {
              hertz: reading.frequency.toFixed(1),
              clarity: Math.round(reading.clarity * 100),
            })
          : ""}
      </AppText>

      {!reading ? (
        <AppText variant="body" tone="muted" style={styles.hint}>
          {status === "running"
            ? t("tuner.playAStructure")
            : status === "denied"
              ? t("tuner.denied")
              : status === "error"
                ? t("tuner.error")
                : t("tuner.listening")}
        </AppText>
      ) : null}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    container: {
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.l,
      width: "100%",
    },
    noteRow: {
      alignItems: "center",
      gap: Theme.spacing.xs,
    },
    note: {
      fontSize: 84,
      lineHeight: 96,
    },
    track: {
      borderRadius: Theme.radii.pill,
      height: 12,
      justifyContent: "center",
      position: "relative",
      width: "86%",
    },
    // The track keeps a defined background from the start: an Android element
    // whose rounded background appears only in a state can paint square.
    trackFill: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: Theme.colors.chrome,
      borderRadius: Theme.radii.pill,
    },
    centerTick: {
      backgroundColor: Theme.colors.textFaint,
      borderRadius: Theme.radii.xs,
      height: 12,
      left: "50%",
      marginLeft: -1,
      position: "absolute",
      width: 2,
    },
    marker: {
      borderRadius: 9,
      height: 18,
      marginLeft: -9,
      position: "absolute",
      width: 18,
    },
    measurement: {
      // JetBrains Mono is already tabular: digits do not jitter on web.
      textAlign: "center",
    },
    hint: {
      textAlign: "center",
    },
  })

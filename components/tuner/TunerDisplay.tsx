import React, { useEffect, useRef } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { displayNote } from "@/libs/chords"
import { hapticTuned } from "@/libs/haptics"
import { usePreferences } from "@/services/prefs"
import type { TunerStreamStatus } from "@/interfaces/tuner"
import type { TunerReading } from "@/libs/tunerEngine"

/** Cents inside this band read as "in tune" — a hair tighter than a fret. */
const IN_TUNE_CENTS = 5
/** Inside this band the needle is "close" (warning colour), beyond it is wide. */
const NEAR_CENTS = 25
/** Hairline ticks every 10 cents across the ±50 track (the centre has its own). */
const TRACK_TICKS = [10, 20, 30, 40, 60, 70, 80, 90]

type TunerDisplayProps = {
  reading: TunerReading
  status: TunerStreamStatus
}

/**
 * The tuner's readout (roadmap #13): one huge note in the reader's own chord
 * notation, one plain-language verdict under it ("Sostenido — baja 24
 * centésimos", never a bare "24¢"), a ±50-cent gauge whose green band is the
 * in-tune zone, and one caption defining what a cent even is. Everything
 * numeric is derived from the last reading — the smoothing (median of five +
 * the needle's exponential glide) and the decay hold live in the engine, so
 * this component never stabilises anything itself. Entering the green band
 * fires the tuned chirp.
 */
export function TunerDisplay({ reading, status }: TunerDisplayProps) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const notation = usePreferences().chordNotation ?? "letters"

  const cents = reading ? Math.round(reading.cents) : 0
  const inTune = reading !== null && Math.abs(reading.cents) <= IN_TUNE_CENTS
  const near = reading !== null && Math.abs(reading.cents) <= NEAR_CENTS
  // Resolved at render (the sanctioned pattern): the readout colour is
  // painted through style, and TextTone has no warning/danger members.
  const readoutColor = inTune
    ? Theme.colors.success
    : near
      ? Theme.colors.warning
      : Theme.colors.danger
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

  // The chirp fires only on the false -> true edge: holding the string in
  // tune must not buzz the phone at 10 Hz.
  const wasInTune = useRef(false)
  useEffect(() => {
    if (inTune && !wasInTune.current) hapticTuned()
    wasInTune.current = inTune
  }, [inTune])

  const accessibilityLabel = reading
    ? t("tuner.readoutA11y", {
        note: `${displayNote(reading.name, notation)}${reading.octave}`,
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
        <AppText
          variant="display"
          tone={reading ? "default" : "faint"}
          style={reading ? { color: readoutColor } : undefined}
        >
          {reading ? `${displayNote(reading.name, notation)}${reading.octave}` : "—"}
        </AppText>
        <AppText variant="subheading" style={{ color: readoutColor }}>
          {!reading
            ? ""
            : inTune
              ? t("tuner.inTune")
              : cents > 0
                ? t("tuner.sharp", { count: Math.abs(cents), cents: Math.abs(cents) })
                : t("tuner.flat", { count: Math.abs(cents), cents: Math.abs(cents) })}
        </AppText>
      </View>

      <View style={styles.gaugeBlock} importantForAccessibility="no">
        <View style={styles.track}>
          <View style={styles.trackFill} />
          <View style={styles.inTuneBand} />
          {TRACK_TICKS.map((tick) => (
            <View key={tick} style={[styles.tick, { left: `${tick}%` }]} />
          ))}
          <View style={styles.centerTick} />
          <View
            style={[
              styles.needle,
              { left: `${markerPosition}%`, backgroundColor: readoutColor },
            ]}
          />
        </View>
        <View style={styles.scaleRow}>
          <AppText variant="caption" tone="muted">
            {t("tuner.scaleFlat")}
          </AppText>
          <AppText variant="caption" tone="muted">
            {t("tuner.scaleSharp")}
          </AppText>
        </View>
      </View>

      <AppText variant="mono" tone="muted" style={styles.measurement}>
        {reading
          ? t("tuner.measurement", {
              hertz: reading.frequency.toFixed(1),
              clarity: Math.round(reading.clarity * 100),
            })
          : ""}
      </AppText>
      <AppText variant="caption" tone="faint" style={styles.centsHint}>
        {t("tuner.centsHint")}
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
      gap: Theme.spacing.s,
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
    gaugeBlock: {
      alignItems: "stretch",
      gap: Theme.spacing.xs,
      width: "94%",
    },
    track: {
      borderRadius: Theme.radii.pill,
      height: 36,
      justifyContent: "center",
      position: "relative",
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
    // The ±5-cent in-tune zone, drawn under everything else.
    inTuneBand: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: "45%",
      width: "10%",
      backgroundColor: Theme.colors.success,
      opacity: 0.28,
      borderRadius: Theme.radii.xs,
    },
    tick: {
      position: "absolute",
      top: "32%",
      bottom: "32%",
      width: 1,
      marginLeft: -0.5,
      backgroundColor: Theme.colors.textFaint,
      opacity: 0.7,
    },
    centerTick: {
      position: "absolute",
      top: "16%",
      bottom: "16%",
      left: "50%",
      width: 2,
      marginLeft: -1,
      backgroundColor: Theme.colors.textMuted,
      borderRadius: Theme.radii.xs,
    },
    needle: {
      position: "absolute",
      top: 3,
      width: 4,
      height: 30,
      marginLeft: -2,
      borderRadius: Theme.radii.xs,
    },
    scaleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    measurement: {
      // JetBrains Mono is already tabular: digits do not jitter on web.
      textAlign: "center",
    },
    centsHint: {
      textAlign: "center",
    },
    hint: {
      textAlign: "center",
    },
  })

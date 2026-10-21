import React, { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { PageHeader } from "@/components/ui/PageHeader"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useChordRecorder } from "@/hooks/useChordRecorder"
import { readExperiments, setExperiment } from "@/services/experiments"

/**
 * Estimates the chords of a recording (roadmap #85).
 *
 * An **experiment**, behind a flag ✓: the member turns it on, plays (or
 * sings) a passage, and the app listens ✓. The result is an **approximation**
 * ✓ — a guitar in a room is not a sine wave ✗ — so every chord carries its
 * confidence ✓ and the screen says so ✓, plainly.
 *
 * Everything happens on the device ✓: the microphone's samples go to the
 * pure core (`libs/chordDetection.ts` ✓) and nothing is uploaded ✗.
 */
export default function ChordDetectionScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const recorder = useChordRecorder()
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    void readExperiments().then((experiments) => {
      if (alive) setEnabled(experiments.chordDetection === true)
    })
    return () => {
      alive = false
    }
  }, [])

  const toggle = async (): Promise<void> => {
    const next = !enabled
    setEnabled(next)
    await setExperiment("chordDetection", next)
  }

  const recording = recorder.status === "recording"
  const busy = recorder.status === "analyzing" || recorder.status === "requesting"

  return (
    <ScreenContainer>
      <PageHeader title={t("chords.title")} subtitle={t("chords.subtitle")} />

      {enabled === null ? null : !enabled ? (
        <View style={styles.block}>
          <Card style={styles.card}>
            <AppText style={styles.text}>{t("chords.experimentOff")}</AppText>
          </Card>
          <Button label={t("chords.turnOn")} onPress={toggle} full />
        </View>
      ) : (
        <View style={styles.block}>
          <Card style={styles.card}>
            <AppText style={styles.text}>{t("chords.howTo")}</AppText>
            <AppText style={styles.warning}>{t("chords.approximate")}</AppText>
          </Card>

          {!recorder.available ? (
            <AppText style={styles.warning}>{t("chords.unavailable")}</AppText>
          ) : (
            <Button
              label={recording ? t("chords.stop") : t("chords.record")}
              onPress={recording ? recorder.stop : recorder.start}
              loading={busy}
              full
            />
          )}

          {recorder.status === "error" ? (
            <AppText style={styles.warning}>{t("chords.failed")}</AppText>
          ) : null}

          {recorder.status === "analyzing" ? (
            <AppText style={styles.text}>{t("chords.analyzing")}</AppText>
          ) : null}

          {recorder.key || recorder.tempo ? (
            <Card style={styles.card}>
              {recorder.key ? (
                <AppText style={styles.key}>{t("chords.key", { key: recorder.key })}</AppText>
              ) : null}
              {recorder.tempo ? (
                <AppText style={styles.text}>{t("chords.bpm", { bpm: recorder.tempo })}</AppText>
              ) : null}
            </Card>
          ) : null}

          {recorder.segments.length > 0 ? (
            <Card style={styles.card}>
              {recorder.segments.map((segment, index) => (
                <View key={`${segment.chord}-${index}`} style={styles.row}>
                  <AppText style={styles.chord}>{segment.chord}</AppText>
                  <AppText style={styles.meta}>
                    {t("chords.duration", {
                      seconds: Math.round((segment.endSec - segment.startSec) * 10) / 10,
                    })}
                  </AppText>
                  <AppText style={styles.meta}>
                    {t("chords.confidence", { percent: Math.round(segment.confidence * 100) })}
                  </AppText>
                </View>
              ))}
            </Card>
          ) : null}

          {recorder.segments.length > 0 ? (
            <Button label={t("chords.again")} onPress={recorder.reset} variant="secondary" full />
          ) : null}

          <Button label={t("chords.turnOff")} onPress={toggle} variant="ghost" full />
        </View>
      )}
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    block: {
      gap: Theme.spacing.m,
      paddingHorizontal: Theme.spacing.l,
      paddingBottom: Theme.spacing.xxl,
    },
    card: {
      gap: Theme.spacing.xs,
    },
    text: {
      color: Theme.colors.text,
      fontSize: Theme.sizes.h5,
    },
    warning: {
      color: Theme.colors.warning,
      fontSize: Theme.sizes.caption,
    },
    key: {
      color: Theme.colors.text,
      fontSize: Theme.sizes.h3,
      fontWeight: "700",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
    },
    chord: {
      color: Theme.colors.text,
      fontSize: Theme.sizes.h4,
      fontWeight: "600",
      width: 56,
    },
    meta: {
      color: Theme.colors.textMuted,
      fontSize: Theme.sizes.caption,
    },
  })

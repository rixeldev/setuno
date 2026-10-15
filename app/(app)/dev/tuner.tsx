import React from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { TunerDisplay } from "@/components/tuner/TunerDisplay"
import { useTunerStream } from "@/hooks/useTunerStream"

/**
 * Chromatic tuner spike (roadmap #13) — deliberately **not** listed in any
 * navigation surface: this is the prototype the roadmap asks for before the
 * tuner is committed to ("do not ship a janky tuner"). Open it directly
 * (`/dev/tuner` in the browser; the route inspector in a dev build on native)
 * and read `docs/tuner_spike_memo.md` for the verdict.
 *
 * Analysis budget: one detection per microphone chunk (~10 Hz) lands at ~2.5 ms
 * per reading on desktop V8; `TunerReading.analysisMs` shows the device's real
 * number under "measurement" so the spike can be validated on hardware.
 */
export default function TunerSpikeScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { status, reading, start, stop } = useTunerStream()

  const running = status === "running"

  return (
    <ScreenContainer title={t("tuner.title")} subtitle={t("tuner.prototype")} back>
      <View style={styles.body}>
        <TunerDisplay reading={reading} status={status} />
        <Button
          label={running ? t("tuner.stop") : t("tuner.start")}
          variant={running ? "secondary" : "primary"}
          size="lg"
          loading={status === "requesting"}
          onPress={() => {
            if (running) {
              stop()
            } else {
              void start()
            }
          }}
        />
        {reading ? (
          <AppText variant="caption" tone="faint" style={styles.budget}>
            {reading.analysisMs.toFixed(1)} ms
          </AppText>
        ) : null}
      </View>
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    body: {
      alignItems: "center",
      gap: Theme.spacing.l,
      width: "100%",
    },
    budget: {
      textAlign: "center",
    },
  })

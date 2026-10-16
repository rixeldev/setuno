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
 * Chromatic tuner (roadmap #13, shipped): the spike the owner validated on
 * hardware ("practically perfect") promoted to a real destination — `TunerIcon`
 * entry in the sidebar and the More tiles. The whole DSP stays where the spike
 * left it: YIN (`libs/pitchDetection.ts`) over the engine's window ring
 * (`libs/tunerEngine.ts`), ~2.5 ms per reading, entirely in JS, no native
 * module beyond the microphone itself.
 *
 * Analysis budget: one detection per microphone chunk (~10 Hz). The faint
 * caption under the gauge prints the device's real `TunerReading.analysisMs`,
 * so the number can be re-checked on any hardware the app runs on.
 *
 * The mic needs a development build on native (Expo Go has no permission
 * entry for it); on the web it runs in the browser.
 */
export default function TunerScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { status, reading, start, stop } = useTunerStream()

  const running = status === "running"

  return (
    <ScreenContainer title={t("tuner.title")} back>
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
            {t("tuner.budget", { ms: reading.analysisMs.toFixed(1) })}
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
      flexGrow: 1,
      justifyContent: "center",
      width: "100%",
    },
    budget: {
      textAlign: "center",
    },
  })

import React from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { Button, IconButton } from "@/components/ui/Button"
import { PauseIcon, PlayFilledIcon } from "@/components/ui/Icons"
import { measureLabel } from "@/libs/metronome"
import { loopPassSeconds, type SectionLoop, type SectionLoopView } from "@/libs/sectionLoop"

/** The section this sheet was opened for: what the title and the start need. */
export interface LoopSection {
  id: string
  /** Rendered label ("Verse 1"), already localized by the reader. */
  label: string
  /** `SongSection.bars`; 0 means "not counted yet" and refuses to loop. */
  bars: number
}

interface SectionLoopSheetProps {
  visible: boolean
  onClose: () => void
  section: LoopSection | null
  bpm: number
  beatsPerMeasure: number
  /** The loop playing right now (`null`: nothing looping). */
  loop: SectionLoop | null
  /** Live position in that loop, or null while stopped. */
  loopView: SectionLoopView | null
  onBpmChange: (bpm: number) => void
  onStart: () => void
  onStop: () => void
}

/**
 * The practice-loop panel (roadmap #15): a count-in bar and then the tapped
 * section's bars, over and over at the transport's tempo, until Stop. It is
 * presentation only — the transport lives in `useMetronome`, the same one the
 * metronome sheet drives, so closing this sheet never stops the loop and the
 * dock's metronome icon stays lit while it plays.
 *
 * A section only loops when it carries a bar count (`SongSection.bars`, #27):
 * the whole value of the loop is landing on the musical boundary, and a
 * guessed length would practise the wrong thing. Without bars the sheet says
 * so and points at the editor instead of faking a length.
 *
 * The display keeps a fixed height in every state (idle, count-in number,
 * pass status), so the controls below never jump under the finger.
 */
export function SectionLoopSheet({
  visible,
  onClose,
  section,
  bpm,
  beatsPerMeasure,
  loop,
  loopView,
  onBpmChange,
  onStart,
  onStop,
}: SectionLoopSheetProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()

  const bars = section?.bars ?? 0
  const loopable = bars > 0
  // "Active" is per section: another section looping must not dress this one
  // in running clothes — its button starts *this* loop and switches over.
  const active = loop !== null && section !== null && loop.sectionId === section.id

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={section?.label ?? ""}
      subtitle={t("songs.loopHint")}
    >
      <View style={styles.body}>
        <View style={styles.display}>
          {active && loopView?.inCountIn ? (
            <AppText variant="display" tone="primary" style={styles.count}>
              {loopView.countInBeat}
            </AppText>
          ) : null}
          {active && loopView && !loopView.inCountIn ? (
            <AppText variant="subheading">{`${t("songs.loopPass", { number: loopView.repeat })} · ${t(
              "songs.loopBar",
              { current: loopView.barInPass, total: loopView.barsPerPass },
            )}`}</AppText>
          ) : null}
          <AppText variant="caption" tone="faint">
            {loopable
              ? `${measureLabel(beatsPerMeasure)} · ${t("songs.bars", { count: bars })} · ${t("songs.loopSeconds", {
                  seconds: Math.round(loopPassSeconds(bars, beatsPerMeasure, bpm)),
                })}`
              : `${measureLabel(beatsPerMeasure)} · ${bpm} BPM`}
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
        </View>

        {loopable ? (
          <Button
            label={active ? t("songs.metronomeStop") : t("songs.metronomeStart")}
            variant={active ? "secondary" : "primary"}
            onPress={active ? onStop : onStart}
            icon={
              active ? (
                <PauseIcon size={16} color={Theme.colors.text} />
              ) : (
                <PlayFilledIcon size={16} color={Theme.colors.onPrimary} />
              )
            }
          />
        ) : (
          <AppText tone="muted">{t("songs.loopNeedsBars")}</AppText>
        )}
      </View>
    </BottomSheet>
  )
}

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
    count: { fontSize: Theme.sizes.hero },
    stepper: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    bpmBox: { alignItems: "center", minWidth: 72 },
  })

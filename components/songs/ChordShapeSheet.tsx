import React, { useMemo, useRef, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { IconButton } from "@/components/ui/Button"
import { Chip } from "@/components/ui/Card"
import { ChevronRightIcon } from "@/components/ui/Icons"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { FretboardDiagram } from "@/components/songs/FretboardDiagram"
import { PianoChord } from "@/components/songs/PianoChord"
import { displayChord, displayNote } from "@/libs/chords"
import {
  capoShapeChord,
  findGuitarShapes,
  findPianoChord,
  pianoNoteNames,
} from "@/libs/chordShapes"
import type { ChordInstrument, ChordNotation } from "@/interfaces/user"

interface ChordShapeSheetProps {
  visible: boolean
  /** Letter spelling of the chord as the reader plays it (post-transpose). */
  chord: string | null
  /** Capo in force: guitar shapes sit `capo` semitones below the chord. */
  capo: number
  notation: ChordNotation
  instrument: ChordInstrument
  onInstrumentChange: (next: ChordInstrument) => void
  onClose: () => void
}

/**
 * “How to play” sheet for a tapped chord (docs §11): piano keys or every
 * guitar voicing, paged. The instrument choice is remembered with the reader
 * settings; with a capo set, the guitar side shows the shape to finger below
 * it, so the capo raises it back to the chord the band plays.
 */
export function ChordShapeSheet({
  visible,
  chord,
  capo,
  notation,
  instrument,
  onInstrumentChange,
  onClose,
}: ChordShapeSheetProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const scrollRef = useRef<ScrollView>(null)
  const [pageWidth, setPageWidth] = useState(0)
  const [index, setIndex] = useState(0)

  const display = chord ? displayChord(chord, notation) : ""
  const shapeName = useMemo(() => (chord ? capoShapeChord(chord, capo) : ""), [capo, chord])
  const shapes = useMemo(
    () => (chord && instrument === "guitar" ? findGuitarShapes(shapeName) : []),
    [chord, instrument, shapeName],
  )
  const piano = useMemo(
    () => (chord && instrument === "piano" ? findPianoChord(chord) : null),
    [chord, instrument],
  )

  // A new chord (or instrument) starts at the first position again: the pager
  // is keyed by both, so it remounts already scrolled to the start.
  const pagerKey = `${chord ?? ""}|${instrument}`
  const [pagerState, setPagerState] = useState(pagerKey)
  if (pagerState !== pagerKey) {
    setPagerState(pagerKey)
    setIndex(0)
  }

  const goTo = (next: number): void => {
    const clamped = Math.max(0, Math.min(next, shapes.length - 1))
    scrollRef.current?.scrollTo({ x: clamped * pageWidth, animated: true })
    setIndex(clamped)
  }

  const guitarView =
    shapes.length === 0 ? (
      <AppText variant="body" tone="muted">
        {t("songs.noShapeForChord")}
      </AppText>
    ) : (
      <View style={styles.pagerWrap}>
        {capo > 0 ? (
          <AppText variant="caption" tone="muted" style={styles.capoNote}>
            {t("songs.capoShapeNote", {
              capo,
              shape: displayChord(shapeName, notation),
            })}
          </AppText>
        ) : null}

        <View
          style={styles.pager}
          onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
        >
          {pageWidth > 0 ? (
            <ScrollView
              key={pagerKey}
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) =>
                setIndex(Math.round(event.nativeEvent.contentOffset.x / pageWidth))
              }
            >
              {shapes.map((shape, shapeIndex) => (
                <View key={`shape-${shapeIndex}`} style={[styles.page, { width: pageWidth }]}>
                  <FretboardDiagram
                    shape={shape}
                    label={`${displayChord(shapeName, notation)} · ${shape.frets
                      .map((fret) => (fret < 0 ? "x" : fret))
                      .join("")}`}
                  />
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>

        <View style={styles.pagerBar}>
          <IconButton
            label={t("songs.previousShape")}
            size={32}
            disabled={index === 0}
            onPress={() => goTo(index - 1)}
            icon={
              <ChevronRightIcon
                size={18}
                color={index === 0 ? Theme.colors.textFaint : Theme.colors.text}
                style={styles.flipped}
              />
            }
          />
          <AppText variant="caption" tone="muted">
            {t("songs.shapePosition", { current: index + 1, total: shapes.length })}
          </AppText>
          <IconButton
            label={t("songs.nextShape")}
            size={32}
            disabled={index === shapes.length - 1}
            onPress={() => goTo(index + 1)}
            icon={
              <ChevronRightIcon
                size={18}
                color={index === shapes.length - 1 ? Theme.colors.textFaint : Theme.colors.text}
              />
            }
          />
        </View>
      </View>
    )

  const notes = piano ? pianoNoteNames(piano).map((name) => displayNote(name, notation)) : []

  const pianoView = piano ? (
    <View style={styles.pianoWrap}>
      <PianoChord shape={piano} label={`${display} · ${notes.join(" ")}`} />
      <AppText variant="caption" tone="muted">
        {t("songs.chordNotes", { notes: notes.join("  ") })}
      </AppText>
    </View>
  ) : (
    <AppText variant="body" tone="muted">
      {t("songs.noShapeForChord")}
    </AppText>
  )

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={chord ? t("songs.howToPlayChord", { chord: display }) : ""}
    >
      {chord ? (
        <>
          <View style={styles.tabs}>
            <Chip
              label={t("songs.instrumentGuitar")}
              size="sm"
              tone="primary"
              selected={instrument === "guitar"}
              onPress={() => onInstrumentChange("guitar")}
            />
            <Chip
              label={t("songs.instrumentPiano")}
              size="sm"
              tone="primary"
              selected={instrument === "piano"}
              onPress={() => onInstrumentChange("piano")}
            />
          </View>
          {instrument === "guitar" ? guitarView : pianoView}
        </>
      ) : null}
    </BottomSheet>
  )
}

const createStyles = () =>
  StyleSheet.create({
    tabs: { flexDirection: "row", gap: Theme.spacing.s, alignSelf: "flex-start" },
    pagerWrap: { gap: Theme.spacing.s },
    capoNote: { textAlign: "center" },
    pager: { width: "100%" },
    page: { alignItems: "center" },
    pagerBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Theme.spacing.l,
    },
    flipped: { transform: [{ rotate: "180deg" }] },
    pianoWrap: { gap: Theme.spacing.s, alignItems: "center" },
  })

import React, { useMemo, useRef, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { IconButton } from "@/components/ui/Button"
import { Chip } from "@/components/ui/Card"
import { ChevronRightIcon, StarFilledIcon, StarIcon } from "@/components/ui/Icons"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { FretboardDiagram } from "@/components/songs/FretboardDiagram"
import { PianoChord } from "@/components/songs/PianoChord"
import { displayChord, displayNote } from "@/libs/chords"
import {
  capoShapeChord,
  findBassChord,
  findFrettedVoicings,
  findPianoChord,
  guitarVoicingId,
  isFrettedInstrument,
  orderGuitarVoicings,
  pianoBassName,
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
  /** Song key (post-transpose), needed to spell chords as Nashville numbers. */
  keyName?: string
  instrument: ChordInstrument
  onInstrumentChange: (next: ChordInstrument) => void
  /** Pinned guitar voicing id for this chord, if the user favourited one (#23). */
  preferredVoicingId?: string | null
  /** Pins or clears the favourite voicing for the current chord (#23). */
  onPinVoicing?: (id: string | null) => void
  onClose: () => void
}

/** The four instruments the sheet can draw, in the order they are offered. */
const INSTRUMENT_TABS: { value: ChordInstrument; labelKey: string }[] = [
  { value: "guitar", labelKey: "songs.instrumentGuitar" },
  { value: "ukulele", labelKey: "songs.instrumentUkulele" },
  { value: "bass", labelKey: "songs.instrumentBass" },
  { value: "piano", labelKey: "songs.instrumentPiano" },
]

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
  keyName = "",
  instrument,
  onInstrumentChange,
  preferredVoicingId = null,
  onPinVoicing,
  onClose,
}: ChordShapeSheetProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const scrollRef = useRef<ScrollView>(null)
  const [pageWidth, setPageWidth] = useState(0)
  const [index, setIndex] = useState(0)

  const display = chord ? displayChord(chord, notation, keyName) : ""
  const shapeName = useMemo(() => (chord ? capoShapeChord(chord, capo) : ""), [capo, chord])
  const fretted = isFrettedInstrument(instrument)
  const voicings = useMemo(
    () =>
      chord && fretted
        ? findFrettedVoicings(shapeName, instrument)
        : { shapes: [], slashBass: null, slashApplied: false },
    [chord, fretted, instrument, shapeName],
  )
  // The pinned voicing opens first (#23); everything else keeps dataset order.
  const shapes = useMemo(
    () => orderGuitarVoicings(voicings.shapes, preferredVoicingId),
    [preferredVoicingId, voicings.shapes],
  )
  const pinned = preferredVoicingId !== null && preferredVoicingId !== undefined
  const piano = useMemo(
    () => (chord && instrument === "piano" ? findPianoChord(chord) : null),
    [chord, instrument],
  )
  // Bass has no dataset (roadmap #24), so its one position is derived.
  const bassShape = useMemo(
    () => (chord && instrument === "bass" ? findBassChord(shapeName) : null),
    [chord, instrument, shapeName],
  )
  const frettedShapes = fretted ? shapes : bassShape ? [bassShape] : []

  // A new chord (or instrument, or pin) starts at the first position again: the
  // pager is keyed by all three, so it remounts already scrolled to the start.
  const pagerKey = `${chord ?? ""}|${instrument}|${preferredVoicingId ?? ""}`
  const [pagerState, setPagerState] = useState(pagerKey)
  if (pagerState !== pagerKey) {
    setPagerState(pagerKey)
    setIndex(0)
  }

  const goTo = (next: number): void => {
    const clamped = Math.max(0, Math.min(next, frettedShapes.length - 1))
    scrollRef.current?.scrollTo({ x: clamped * pageWidth, animated: true })
    setIndex(clamped)
  }

  const frettedView =
    frettedShapes.length === 0 ? (
      <AppText variant="body" tone="muted">
        {t("songs.noShapeForChord")}
      </AppText>
    ) : (
      <View style={styles.pagerWrap}>
        {capo > 0 ? (
          <AppText variant="caption" tone="muted" style={styles.capoNote}>
            {t("songs.capoShapeNote", {
              capo,
              shape: displayChord(shapeName, notation, keyName),
            })}
          </AppText>
        ) : null}

        {voicings.slashBass && !voicings.slashApplied ? (
          <AppText variant="caption" tone="muted" style={styles.capoNote}>
            {t("songs.slashFallback", {
              chord: displayChord(shapeName, notation, keyName),
              fallback: displayChord(shapeName.split("/")[0] ?? shapeName, notation, keyName),
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
              {frettedShapes.map((shape, shapeIndex) => (
                <View key={`shape-${shapeIndex}`} style={[styles.page, { width: pageWidth }]}>
                  <FretboardDiagram
                    shape={shape}
                    label={`${displayChord(shapeName, notation, keyName)} · ${shape.frets
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
            {t("songs.shapePosition", { current: index + 1, total: frettedShapes.length })}
          </AppText>
          <IconButton
            label={t("songs.nextShape")}
            size={32}
            disabled={index === frettedShapes.length - 1}
            onPress={() => goTo(index + 1)}
            icon={
              <ChevronRightIcon
                size={18}
                color={index === frettedShapes.length - 1 ? Theme.colors.textFaint : Theme.colors.text}
              />
            }
          />
          {/* Bass derives a single position, so there is nothing to pin (#23). */}
          {onPinVoicing && fretted ? (
            <IconButton
              label={
                pinned
                  ? t("songs.unpinVoicing")
                  : t("songs.pinVoicing", { chord: displayChord(shapeName, notation, keyName) })
              }
              size={32}
              onPress={() => {
                const current = frettedShapes[index]
                if (!current) return
                const id = guitarVoicingId(current)
                // Tapping the already-pinned position clears the favourite.
                onPinVoicing(pinned && preferredVoicingId === id ? null : id)
              }}
              icon={
                pinned ? (
                  <StarFilledIcon size={18} color={Theme.colors.warning} />
                ) : (
                  <StarIcon size={18} color={Theme.colors.textMuted} />
                )
              }
            />
          ) : null}
        </View>
        {pinned ? (
          <AppText variant="caption" tone="muted" style={styles.capoNote}>
            {t("songs.pinnedVoicingNote")}
          </AppText>
        ) : null}
      </View>
    )

  const notes = piano
    ? pianoNoteNames(piano).map((name) => displayNote(name, notation, keyName))
    : []
  const bass = piano ? pianoBassName(piano) : null

  const pianoView = piano ? (
    <View style={styles.pianoWrap}>
      {/* Two octaves do not fit a very narrow phone: scrolling keeps every
          key reachable instead of clipping the keyboard. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pianoScroll}
        contentContainerStyle={styles.pianoScrollContent}
      >
        <PianoChord shape={piano} label={`${display} · ${notes.join(" ")}`} />
      </ScrollView>
      <AppText variant="caption" tone="muted">
        {t("songs.chordNotes", { notes: notes.join("  ") })}
      </AppText>
      {bass ? (
        <AppText variant="caption" tone="muted">
          {t("songs.slashBassNote", { note: displayNote(bass, notation, keyName) })}
        </AppText>
      ) : null}
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
            {INSTRUMENT_TABS.map((tab) => (
              <Chip
                key={tab.value}
                label={t(tab.labelKey)}
                size="sm"
                tone="primary"
                selected={instrument === tab.value}
                onPress={() => onInstrumentChange(tab.value)}
              />
            ))}
          </View>
          {instrument === "piano" ? pianoView : frettedView}
        </>
      ) : null}
    </BottomSheet>
  )
}

const createStyles = () =>
  StyleSheet.create({
    /** Wraps: four instruments never share one row on a phone. */
    tabs: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Theme.spacing.s,
      alignSelf: "flex-start",
    },
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
    pianoScroll: { width: "100%" },
    pianoScrollContent: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  })

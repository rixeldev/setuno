import React, { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { displayChord } from "@/libs/chords"
import { buildChordSegments } from "@/libs/songUtils"
import type { ChordNotation, LyricLine } from "@/interfaces"

interface ChordLineProps {
  line: LyricLine
  fontSize: number
  showChords: boolean
  /** Chord spelling: letters (C) or solfège (Do). Display-only. */
  notation?: ChordNotation
  /** Dims lyric lines without chords so structure stays readable. */
  dimEmpty?: boolean
  /** Makes every chord tappable (the reader opens its “how to play” sheet). */
  onChordPress?: (chord: string) => void
}

/**
 * Renders a lyric line with its chords in a monospace pair of rows, so every
 * chord sits exactly above the character it belongs to (docs §11, §39).
 *
 * Chords are anchored to a character offset (`ChordPosition.position`) which
 * makes the alignment deterministic on both Android and Web. The row is built
 * as segments so each chord can be pressed without altering the grid.
 */
export function ChordLine({
  line,
  fontSize,
  showChords,
  notation = "letters",
  dimEmpty = true,
  onChordPress,
}: ChordLineProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const chords = useMemo(
    () =>
      line.chords
        .filter((chord) => chord.chord.trim().length > 0)
        .sort((a, b) => a.position - b.position),
    [line.chords],
  )
  const segments = useMemo(
    () =>
      buildChordSegments(
        chords.map((chord) => ({ ...chord, label: displayChord(chord.chord, notation) })),
        line.text,
      ),
    [chords, line.text, notation],
  )
  const lineHeight = Math.round(fontSize * 1.65)
  const hasContent = line.text.trim().length > 0 || chords.length > 0

  // A line without lyrics (intro, instrumental, riff) is a chord progression:
  // the chords are the content, so they get the full row as modern pills
  // instead of a monospace grid followed by an empty lyric line.
  if (line.text.trim().length === 0) {
    if (!showChords || chords.length === 0) {
      // Blank lyric lines are paragraph spacing: keep a small gap.
      return <View style={{ height: Math.round(fontSize * 0.6) }} />
    }
    return (
      <View
        style={styles.progression}
        accessible={!onChordPress}
        accessibilityLabel={
          onChordPress
            ? undefined
            : `Chords: ${chords.map((chord) => displayChord(chord.chord, notation)).join(", ")}`
        }
      >
        {chords.map((chord, index) => {
          const label = displayChord(chord.chord, notation)
          return (
            <Pressable
              key={`${chord.chord}-${index}`}
              disabled={!onChordPress}
              onPress={onChordPress ? () => onChordPress(chord.chord) : undefined}
              accessibilityRole={onChordPress ? "button" : undefined}
              accessibilityLabel={onChordPress ? t("songs.openChord", { chord: label }) : undefined}
              style={styles.progressionChord}
            >
              <Text
                selectable={false}
                style={[styles.progressionText, { fontSize: Math.max(12, fontSize - 2) }]}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    )
  }

  return (
    <View style={styles.line}>
      {showChords && segments.length > 0 ? (
        <Text
          selectable={false}
          accessibilityLabel={
            onChordPress
              ? undefined
              : `Chords: ${chords.map((chord) => displayChord(chord.chord, notation)).join(", ")}`
          }
          style={[styles.chords, { fontSize, lineHeight: Math.round(fontSize * 1.25) }]}
        >
          {segments.map((segment, segmentIndex) => {
            const chordValue = segment.chord
            return chordValue && onChordPress ? (
              <Text
                key={`chord-${segmentIndex}`}
                suppressHighlighting
                accessibilityRole="button"
                accessibilityLabel={t("songs.openChord", { chord: segment.text })}
                onPress={() => onChordPress(chordValue)}
              >
                {segment.text}
              </Text>
            ) : (
              segment.text
            )
          })}
        </Text>
      ) : null}
      <Text
        selectable
        style={[
          styles.lyrics,
          { fontSize, lineHeight },
          dimEmpty && line.text.trim().length === 0 && styles.emptyLyric,
        ]}
      >
        {line.text.length > 0 ? line.text : " "}
      </Text>
      {!hasContent ? <View style={{ height: fontSize * 0.5 }} /> : null}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    line: {
      gap: 0,
      paddingVertical: 2,
    },
    chords: {
      color: Theme.colors.accent,
      fontFamily: Theme.fonts.mono,
      // Regular weight only: the bundled mono loads a single face, so asking for
      // bold would fall back to a platform font and break the character grid.
      // The accent colour is what makes the row stand out.
      includeFontPadding: false,
    },
    lyrics: {
      color: Theme.colors.text,
      fontFamily: Theme.fonts.mono,
      includeFontPadding: false,
    },
    emptyLyric: {
      color: Theme.colors.textFaint,
    },
    progression: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: Theme.spacing.s,
      paddingVertical: Theme.spacing.xs,
    },
    progressionChord: {
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: 6,
      borderRadius: Theme.radii.m,
      backgroundColor: Theme.colors.accentSoft,
    },
    progressionText: {
      color: Theme.colors.accent,
      // Same single-face mono as the grids: no bold request, or Android would
      // swap in a different family (see `chords` above).
      fontFamily: Theme.fonts.mono,
    },
  })

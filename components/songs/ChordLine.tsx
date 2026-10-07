import React, { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { displayChord } from "@/libs/chords"
import { buildChordRow } from "@/libs/songUtils"
import type { ChordNotation, LyricLine } from "@/interfaces"

interface ChordLineProps {
  line: LyricLine
  fontSize: number
  showChords: boolean
  /** Chord spelling: letters (C) or solfège (Do). Display-only. */
  notation?: ChordNotation
  /** Dims lyric lines without chords so structure stays readable. */
  dimEmpty?: boolean
}

/**
 * Renders a lyric line with its chords in a monospace pair of rows, so every
 * chord sits exactly above the character it belongs to (docs §11, §39).
 *
 * Chords are anchored to a character offset (`ChordPosition.position`) which
 * makes the alignment deterministic on both Android and Web.
 */
export function ChordLine({ line, fontSize, showChords, notation = "letters", dimEmpty = true }: ChordLineProps) {
  const styles = useThemedStyles(createStyles)
  const chords = useMemo(
    () =>
      line.chords
        .filter((chord) => chord.chord.trim().length > 0)
        .sort((a, b) => a.position - b.position)
        .map((chord) => ({ ...chord, chord: displayChord(chord.chord, notation) })),
    [line.chords, notation],
  )

  const chordRow = useMemo(() => buildChordRow(chords, line.text), [chords, line.text])
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
        accessible
        accessibilityLabel={`Chords: ${chords.map((chord) => chord.chord).join(", ")}`}
      >
        {chords.map((chord, index) => (
          <View key={`${chord.chord}-${index}`} style={styles.progressionChord}>
            <Text
              selectable={false}
              style={[styles.progressionText, { fontSize: Math.max(12, fontSize - 2) }]}
            >
              {chord.chord}
            </Text>
          </View>
        ))}
      </View>
    )
  }

  return (
    <View style={styles.line}>
      {showChords && chordRow.length > 0 ? (
        <Text
          selectable={false}
          accessibilityLabel={`Chords: ${chords.map((chord) => chord.chord).join(", ")}`}
          style={[styles.chords, { fontSize, lineHeight: Math.round(fontSize * 1.25) }]}
        >
          {chordRow}
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
      // No `fontWeight` here: the chord row is a character grid padded with
      // spaces, and on Android a bold request on a family without a bold face
      // can resolve to the default proportional font — the spaces then render
      // narrower than the lyric characters and every chord drifts left. The
      // accent colour is what makes the row stand out.
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
      fontFamily: Theme.fonts.mono,
      fontWeight: "700",
    },
  })

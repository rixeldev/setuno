import React, { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import type { ChordPosition, LyricLine } from "@/interfaces"

interface ChordLineProps {
  line: LyricLine
  fontSize: number
  showChords: boolean
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
export function ChordLine({ line, fontSize, showChords, dimEmpty = true }: ChordLineProps) {
  const styles = useThemedStyles(createStyles)
  const chords = useMemo(
    () =>
      line.chords
        .filter((chord) => chord.chord.trim().length > 0)
        .sort((a, b) => a.position - b.position),
    [line.chords],
  )

  const chordRow = useMemo(() => buildChordRow(chords, line.text), [chords, line.text])
  const lineHeight = Math.round(fontSize * 1.65)
  const hasContent = line.text.trim().length > 0 || chords.length > 0

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

/**
 * Pads a monospace string so each chord starts exactly `position` characters
 * into the row. Overlapping chords are shifted one column to stay readable.
 */
export const buildChordRow = (chords: ChordPosition[], text: string): string => {
  if (chords.length === 0) return ""
  const limit = text.length
  let row = ""

  for (const chord of chords) {
    const target = Math.max(0, Math.min(Math.round(chord.position), limit))
    // Never place a chord before the end of the previous one.
    const start = Math.max(target, row.length)
    if (start > row.length) row += " ".repeat(start - row.length)
    row += chord.chord.trim()
    row += " "
  }

  return row
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
      fontWeight: "700",
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
  })

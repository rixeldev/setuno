import React, { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { displayChord } from "@/libs/chords"
import { splitLyricRows } from "@/libs/lyricRows"
import { buildChordSegments } from "@/libs/songUtils"
import type { ChordNotation, ChordView, LyricLine } from "@/interfaces"

interface ChordLineProps {
  line: LyricLine
  fontSize: number
  /** Chords above the lyrics ("both"), lyrics only, or a chord chart (#6). */
  view?: ChordView
  /** Song key, needed to spell chords as Nashville numbers. */
  songKey?: string
  /** Chord spelling: letters (C), solfège (Do) or Nashville (1 4 5). Display-only. */
  notation?: ChordNotation
  /** Makes every chord tappable (the reader opens its “how to play” sheet). */
  onChordPress?: (chord: string) => void
  /**
   * How many monospace characters fit on a row. `0` (the default) means the
   * room is unknown, and the line is drawn as one row.
   */
  charsPerRow?: number
}

/**
 * Renders a lyric line with its chords. In the default layout the chords sit in
 * a monospace row exactly above the character they belong to (docs §11, §39),
 * anchored to a character offset (`ChordPosition.position`) so alignment is
 * deterministic on Android and Web alike. Chords-only mode drops the lyrics and
 * lays the progression out as pills instead, and any line without lyrics
 * (intro, instrumental, riff) is always a progression.
 *
 * **A line that does not fit is cut here, not by the platform.** The chord row
 * is mostly padding, so the platform wraps it wherever it happens to fit while
 * the lyric wraps at word boundaries — and from that row on, every chord sits
 * over the wrong word. `splitLyricRows` cuts the line into rows that fit (a
 * chord that would not fit moves the cut earlier), and each row is drawn as
 * its own chord row over its own lyric row, so the two can never drift apart.
 */
export function ChordLine({
  line,
  fontSize,
  view = "both",
  songKey = "",
  notation = "letters",
  onChordPress,
  charsPerRow = 0,
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
  const labels = useMemo(
    () => chords.map((chord) => displayChord(chord.chord, notation, songKey)),
    [chords, notation, songKey],
  )
  const entries = useMemo(
    () => chords.map((chord, index) => ({ ...chord, label: labels[index] ?? chord.chord })),
    [chords, labels],
  )
  const rows = useMemo(
    () => splitLyricRows(line.text, entries, charsPerRow),
    [line.text, entries, charsPerRow],
  )
  const lineHeight = Math.round(fontSize * 1.65)
  const hasLyrics = line.text.trim().length > 0
  const chordList = labels.join(", ")

  // Blank lines are paragraph spacing: keep a small gap.
  if (!hasLyrics && chords.length === 0) {
    return <View style={{ height: Math.round(fontSize * 0.6) }} />
  }

  // Lyrics-only (#6): hide every chord, keep the song's shape.
  if (view === "lyrics") {
    if (!hasLyrics) return <View style={{ height: Math.round(fontSize * 0.6) }} />
    return (
      <View style={styles.line}>
        <Text selectable style={[styles.lyrics, { fontSize, lineHeight }]}>
          {line.text}
        </Text>
      </View>
    )
  }

  // A line without lyrics (intro, instrumental, riff) is a chord progression:
  // the chords are the content, so they get the full row as modern pills
  // instead of a monospace grid followed by an empty lyric line. Chords-only
  // mode shows every line this way.
  if (!hasLyrics || view === "chords") {
    if (chords.length === 0) return <View style={{ height: Math.round(fontSize * 0.6) }} />
    return (
      <View
        style={styles.progression}
        accessible={!onChordPress}
        accessibilityLabel={onChordPress ? undefined : t("songs.chordListA11y", { chords: chordList })}
      >
        {chords.map((chord, index) => {
          const label = labels[index] ?? chord.chord
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
      {rows.map((row, rowIndex) => {
        const segments = buildChordSegments(
          row.chords.map((chord) => ({
            chord: chord.chord,
            position: chord.offset,
            label: chord.label,
          })),
          row.text,
        )
        const rowChordList = row.chords.map((chord) => chord.label).join(", ")
        return (
          <View key={`row-${rowIndex}`} style={styles.row}>
            {segments.length > 0 ? (
              <Text
                selectable={false}
                accessibilityLabel={
                  onChordPress ? undefined : t("songs.chordListA11y", { chords: rowChordList })
                }
                style={[styles.chords, { fontSize, lineHeight: Math.round(fontSize * 1.25) }]}
              >
                {segments.map((segment, segmentIndex) => {
                  const chordValue = segment.chord
                  if (chordValue && onChordPress) {
                    return (
                      <Text
                        key={`chord-${segmentIndex}`}
                        suppressHighlighting
                        accessibilityRole="button"
                        accessibilityLabel={t("songs.openChord", { chord: segment.text })}
                        onPress={() => onChordPress(chordValue)}
                      >
                        {segment.text}
                      </Text>
                    )
                  }
                  // The padding of the grid is a non-breaking space: the row
                  // is drawn as one block and must never wrap on its own.
                  return chordValue ? segment.text : segment.text.replace(/ /g, "\u00A0")
                })}
              </Text>
            ) : null}
            <Text selectable style={[styles.lyrics, { fontSize, lineHeight }]}>
              {row.text}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    line: {
      gap: 0,
      paddingVertical: 2,
    },
    // One visual row of the line: its chord row and the lyric under it.
    row: { gap: 0 },
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

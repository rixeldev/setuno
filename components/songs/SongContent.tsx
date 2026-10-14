import React, { useMemo } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { NoteIcon } from "@/components/ui/Icons"
import { ChordLine } from "@/components/songs/ChordLine"
import { transposeSections, sectionLabelFor, balanceColumns } from "@/libs/songUtils"
import { markersOfSong } from "@/libs/annotations"
import type { AnnotationMarker, ChordNotation, ChordView, SongSection } from "@/interfaces"

interface SongContentProps {
  sections: SongSection[]
  fontSize: number
  /** Chords above the lyrics ("both"), lyrics only, or a chord chart (#6). */
  view?: ChordView
  /** Semitone shift applied to a copy of the data (never mutates the song). */
  semitones?: number
  /** Song key (post-transpose), needed to spell chords as Nashville numbers. */
  songKey?: string
  /** Chord spelling: letters (C), solfège (Do) or Nashville (1 4 5). Display-only. */
  notation?: ChordNotation
  /** Columns the body flows across (#9): 1 on phones, 2 on tablets/desktop. */
  columns?: number
  /** Highlights a section while scrolling from a suggestion. */
  highlightSectionId?: string | null
  /** Makes every chord tappable (the reader opens its “how to play” sheet). */
  onChordPress?: (chord: string) => void
  /** Personal inline notes to render as markers next to their lines (#3). */
  markers?: AnnotationMarker[]
  /** Opens the annotations editor for a tapped marker. */
  onMarkerPress?: (marker: AnnotationMarker) => void
}

/**
 * Full song body: section headers plus chord/lyric lines, optionally
 * transposed for the current gig.
 */
export function SongContent({
  sections,
  fontSize,
  view = "both",
  semitones = 0,
  songKey = "",
  notation = "letters",
  columns = 1,
  highlightSectionId = null,
  onChordPress,
  markers = [],
  onMarkerPress,
}: SongContentProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const transposed = useMemo(() => transposeSections(sections, semitones), [sections, semitones])
  const boards = useMemo(() => markersOfSong(markers, transposed), [markers, transposed])
  // Wide screens flow the song across two columns (#9). Sections stay whole and
  // in order, and each entry keeps its index in the full list so the numbered
  // section labels ("Verse 1") read correctly across the break.
  const columnCount = Math.max(1, columns)
  const columnsTaken = useMemo(() => {
    const entries = transposed.map((section, index) => ({ section, index }))
    if (columnCount <= 1) return [entries]
    return balanceColumns(entries, (entry) => entry.section.lines.length + 1, columnCount)
  }, [transposed, columnCount])

  if (transposed.length === 0) {
    return (
      <View style={styles.empty}>
        <AppText tone="muted">{t("songs.noLyricsYet")}</AppText>
      </View>
    )
  }

  return (
    <View style={[styles.container, columnCount > 1 && styles.containerColumns]}>
      {columnsTaken.map((group, columnIndex) => (
        <View key={`column-${columnIndex}`} style={styles.column}>
          {group.map(({ section, index }, localIndex) => {
            const sectionMarkers = boards.bySection.get(section.id) ?? []
            return (
              <View
                key={section.id}
                style={[
                  styles.section,
                  localIndex > 0 && styles.sectionGap,
                  highlightSectionId === section.id && styles.sectionHighlighted,
                ]}
              >
                {sectionMarkers.length > 0 ? (
                  <MarkerChips markers={sectionMarkers} onPress={onMarkerPress} />
                ) : null}
                {section.lines.length > 0 || section.label.length > 0 ? (
                  <View style={styles.sectionHeading}>
                    <AppText variant="label" tone="primary" style={styles.sectionLabel}>
                      {sectionLabelFor(transposed, index, t)}
                    </AppText>
                    {section.bars ? (
                      <AppText variant="caption" tone="faint">
                        {t("songs.bars", { count: section.bars })}
                      </AppText>
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.lines}>
                  {section.lines.map((line, lineIndex) => {
                    const lineMarkers = boards.byLine.get(`${section.id}:${lineIndex}`) ?? []
                    return (
                      <View key={`${section.id}-${lineIndex}`}>
                        {lineMarkers.length > 0 ? (
                          <MarkerChips markers={lineMarkers} onPress={onMarkerPress} />
                        ) : null}
                        <ChordLine
                          line={line}
                          fontSize={fontSize}
                          view={view}
                          songKey={songKey}
                          notation={notation}
                          onChordPress={onChordPress}
                        />
                      </View>
                    )
                  })}
                </View>
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

/** Row of private-note chips anchored to one line (or a whole section). */
function MarkerChips({
  markers,
  onPress,
}: {
  markers: AnnotationMarker[]
  onPress?: (marker: AnnotationMarker) => void
}) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  if (markers.length === 0) return null
  return (
    <View style={styles.markerRow}>
      {markers.map((marker) => (
        <Pressable
          key={marker.id}
          accessibilityRole="button"
          accessibilityLabel={t("annotations.markerA11y", { text: marker.text })}
          onPress={onPress ? () => onPress(marker) : undefined}
          style={({ pressed }) => [styles.markerChip, pressed && styles.pressed]}
        >
          <NoteIcon size={12} color={Theme.colors.accent} />
          <AppText variant="caption" tone="accent" numberOfLines={1} style={styles.markerText}>
            {marker.text}
          </AppText>
        </Pressable>
      ))}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    container: { gap: Theme.spacing.s },
    // Two columns (#9): a wider gutter between them keeps the monospace grids
    // from reading as one block, and `alignItems: flex-start` stops a short
    // column from stretching its sections to the tallest one.
    containerColumns: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Theme.spacing.xl,
    },
    column: { flex: 1, minWidth: 0, gap: Theme.spacing.s },
    section: { gap: Theme.spacing.s },
    sectionGap: { marginTop: Theme.spacing.l },
    sectionHighlighted: {
      backgroundColor: Theme.colors.primarySoft,
      borderRadius: Theme.radii.m,
      padding: Theme.spacing.m,
      marginHorizontal: -Theme.spacing.m,
    },
    sectionHeading: { flexDirection: "row", alignItems: "baseline", gap: Theme.spacing.s, flexWrap: "wrap" },
    sectionLabel: { letterSpacing: 1.2 },
    lines: { gap: 2 },
    // The chip row sits above the anchored line (or label), so the monospace
    // chord/lyric grid is never shifted by an inline element.
    markerRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
      paddingVertical: 2,
    },
    markerChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: Theme.spacing.s,
      paddingVertical: 3,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.accentSoft,
    },
    markerText: { maxWidth: 240, flexShrink: 1 },
    pressed: { opacity: 0.7 },
    empty: { padding: Theme.spacing.xl, alignItems: "center" },
  })

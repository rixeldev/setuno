import React, { useMemo } from "react"
import { StyleSheet, View } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { ChordLine } from "@/components/songs/ChordLine"
import { transposeSections } from "@/libs/songUtils"
import type { SongSection } from "@/interfaces"

interface SongContentProps {
  sections: SongSection[]
  fontSize: number
  showChords: boolean
  /** Semitone shift applied to a copy of the data (never mutates the song). */
  semitones?: number
  /** Highlights a section while scrolling from a suggestion. */
  highlightSectionId?: string | null
}

/**
 * Full song body: section headers plus chord/lyric lines, optionally
 * transposed for the current gig.
 */
export function SongContent({
  sections,
  fontSize,
  showChords,
  semitones = 0,
  highlightSectionId = null,
}: SongContentProps) {
  const styles = useThemedStyles(createStyles)
  const view = useMemo(() => transposeSections(sections, semitones), [sections, semitones])

  if (view.length === 0) {
    return (
      <View style={styles.empty}>
        <AppText tone="muted">This song has no lyrics yet.</AppText>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {view.map((section, index) => (
        <View
          key={section.id}
          style={[
            styles.section,
            index > 0 && styles.sectionGap,
            highlightSectionId === section.id && styles.sectionHighlighted,
          ]}
        >
          {section.lines.length > 0 || section.label.length > 0 ? (
            <AppText variant="label" tone="primary" style={styles.sectionLabel}>
              {section.label}
            </AppText>
          ) : null}
          <View style={styles.lines}>
            {section.lines.map((line, lineIndex) => (
              <ChordLine
                key={`${section.id}-${lineIndex}`}
                line={line}
                fontSize={fontSize}
                showChords={showChords}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    container: { gap: Theme.spacing.s },
    section: { gap: Theme.spacing.s },
    sectionGap: { marginTop: Theme.spacing.l },
    sectionHighlighted: {
      backgroundColor: Theme.colors.primarySoft,
      borderRadius: Theme.radii.m,
      padding: Theme.spacing.m,
      marginHorizontal: -Theme.spacing.m,
    },
    sectionLabel: { letterSpacing: 1.2 },
    lines: { gap: 2 },
    empty: { padding: Theme.spacing.xl, alignItems: "center" },
  })

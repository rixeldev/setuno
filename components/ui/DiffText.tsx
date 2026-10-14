import React from "react"
import { StyleSheet, Text } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import type { DiffSegment } from "@/libs/songDiff"

interface DiffTextProps {
  segments: DiffSegment[]
  /**
   * Draws the row in the monospace face, which is what a chord grid needs: its
   * columns only line up while every run shares one font.
   */
  mono?: boolean
}

/** The two sides a diff describes, in order, as they render. */
const reconstruct = (segments: DiffSegment[], kinds: DiffSegment["kind"][]): string =>
  segments
    .filter((segment) => kinds.includes(segment.kind))
    .map((segment) => segment.text)
    .join("")

/**
 * Renders the runs `libs/songDiff.ts` produces as one flowing line: kept text
 * untouched, what is there now struck through in danger, what is proposed
 * highlighted on the accent. Spans are plain `Text` rather than `AppText` on
 * purpose — the outer `AppText` owns the type scale, and a span that re-applied
 * it would fight the row's line height in the middle of a sentence.
 *
 * A screen reader hears both spellings in order with nothing to say which is
 * which, so the line carries an accessibility label spelling the two sides out,
 * and only while something actually changed.
 */
export function DiffText({ segments, mono = false }: DiffTextProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()

  if (segments.length === 0) return null

  const changed = segments.some((segment) => segment.kind !== "same")

  return (
    <AppText
      variant={mono ? "mono" : "body"}
      accessibilityRole={changed ? "text" : undefined}
      accessibilityLabel={
        changed ?
          t("common.diffA11y", {
            from: reconstruct(segments, ["same", "removed"]),
            to: reconstruct(segments, ["same", "added"]),
          })
        : undefined
      }
    >
      {segments.map((segment, index) => (
        <Text
          key={index}
          style={
            segment.kind === "added" ?
              styles.added
            : segment.kind === "removed" ?
              styles.removed
            : undefined
          }
        >
          {segment.text}
        </Text>
      ))}
    </AppText>
  )
}

const createStyles = () =>
  StyleSheet.create({
    /** The proposal: text on a soft accent wash. */
    added: {
      color: Theme.colors.accent,
      backgroundColor: Theme.colors.accentSoft,
    },
    /** What is there now: struck through on a soft danger wash. */
    removed: {
      color: Theme.colors.danger,
      backgroundColor: Theme.colors.dangerSoft,
      textDecorationLine: "line-through",
    },
  })

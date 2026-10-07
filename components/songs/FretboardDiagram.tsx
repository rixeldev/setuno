import React from "react"
import { StyleSheet, View } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import type { GuitarShape } from "@/libs/chordShapes"

const STRINGS = 6
const FRETS = 5
const STRING_GAP = 24
const FRET_GAP = 26
const DOT = 20
const TOP = 28
const PAD = 20

interface FretboardDiagramProps {
  shape: GuitarShape
  /** Screen-reader description, e.g. "Shape of C · x32010". */
  label: string
}

/**
 * A guitar chord diagram: six strings, five frets, finger dots, barres and the
 * open/muted markers. Drawn with plain views so it renders identically on every
 * platform without extra native modules.
 */
export function FretboardDiagram({ shape, label }: FretboardDiagramProps) {
  const styles = useThemedStyles(createStyles)
  const width = PAD * 2 + STRING_GAP * (STRINGS - 1)
  const height = TOP + FRET_GAP * FRETS + Theme.spacing.s
  const nut = shape.baseFret <= 1
  const stringX = (index: number): number => PAD + index * STRING_GAP
  const rowTop = (fret: number): number => TOP + (fret - 1) * FRET_GAP

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.wrap}>
      <View
        style={[styles.board, { width, height }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: STRINGS }).map((_, index) => (
          <View
            key={`string-${index}`}
            style={[styles.string, { left: stringX(index), top: TOP, height: FRET_GAP * FRETS }]}
          />
        ))}

        {Array.from({ length: FRETS + 1 }).map((_, fret) => (
          <View
            key={`fret-${fret}`}
            style={[
              styles.fret,
              {
                left: PAD,
                width: width - PAD * 2,
                top: TOP + fret * FRET_GAP,
                height: fret === 0 && nut ? 3 : 1,
              },
            ]}
          />
        ))}

        {!nut ? (
          <AppText variant="caption" tone="muted" style={[styles.baseFret, { top: TOP + 6 }]}>
            {shape.baseFret}fr
          </AppText>
        ) : null}

        {shape.frets.map((fret, index) =>
          fret <= 0 ? (
            <AppText
              key={`marker-${index}`}
              variant="caption"
              tone="faint"
              style={[styles.marker, { left: stringX(index) - 6 }]}
            >
              {fret === 0 ? "O" : "×"}
            </AppText>
          ) : null,
        )}

        {shape.barres.map((fret) => {
          const strings = shape.frets
            .map((value, index) => (value === fret ? index : -1))
            .filter((index) => index >= 0)
          if (strings.length < 2) return null
          const first = Math.min(...strings)
          const last = Math.max(...strings)
          return (
            <View
              key={`barre-${fret}`}
              style={[
                styles.barre,
                {
                  left: stringX(first) - DOT / 2 + 1,
                  top: rowTop(fret) + (FRET_GAP - DOT) / 2,
                  width: (last - first) * STRING_GAP + DOT - 2,
                },
              ]}
            />
          )
        })}

        {shape.frets.map((fret, index) =>
          fret > 0 ? (
            <View
              key={`dot-${index}`}
              style={[
                styles.dot,
                { left: stringX(index) - DOT / 2, top: rowTop(fret) + (FRET_GAP - DOT) / 2 },
              ]}
            >
              {shape.fingers[index] > 0 ? (
                <AppText variant="caption" tone="inverse" style={styles.finger}>
                  {shape.fingers[index]}
                </AppText>
              ) : null}
            </View>
          ) : null,
        )}
      </View>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    wrap: { alignItems: "center" },
    board: { position: "relative" },
    string: { position: "absolute", width: 1, backgroundColor: Theme.colors.border },
    fret: { position: "absolute", backgroundColor: Theme.colors.border },
    baseFret: { position: "absolute", left: 0 },
    marker: { position: "absolute", top: 4, width: 14, textAlign: "center" },
    barre: {
      position: "absolute",
      height: DOT,
      borderRadius: DOT / 2,
      backgroundColor: Theme.colors.primary,
    },
    dot: {
      position: "absolute",
      width: DOT,
      height: DOT,
      borderRadius: DOT / 2,
      backgroundColor: Theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    finger: { fontSize: 10, lineHeight: 12 },
  })

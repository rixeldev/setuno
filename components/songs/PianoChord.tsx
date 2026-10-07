import React from "react"
import { StyleSheet, View } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import type { PianoChordShape } from "@/libs/chordShapes"

const WHITE_PITCHES = [0, 2, 4, 5, 7, 9, 11]
const BLACK_KEYS: { pitch: number; afterWhite: number }[] = [
  { pitch: 1, afterWhite: 0 },
  { pitch: 3, afterWhite: 1 },
  { pitch: 6, afterWhite: 3 },
  { pitch: 8, afterWhite: 4 },
  { pitch: 10, afterWhite: 5 },
]
const OCTAVES = 2
const WHITE_W = 22
const WHITE_H = 104
const BLACK_W = 13
const BLACK_H = 64

interface PianoChordProps {
  shape: PianoChordShape
  /** Screen-reader description, e.g. "Am7 · A C E G". */
  label: string
}

/**
 * Two-octave keyboard with the chord notes lit: the root is outlined, other
 * notes are tinted and the slash bass keeps an accent edge. Plain views, so it
 * works on Android, iOS and web alike.
 */
export function PianoChord({ shape, label }: PianoChordProps) {
  const styles = useThemedStyles(createStyles)
  const whites = OCTAVES * 7
  const width = whites * WHITE_W
  const isActive = (pitch: number): boolean => shape.pitchClasses.includes(pitch)
  const isRoot = (pitch: number): boolean => pitch === shape.rootIndex
  const isBass = (pitch: number): boolean => shape.bassIndex !== null && pitch === shape.bassIndex

  return (
    <View accessible accessibilityLabel={label} style={styles.wrap}>
      <View
        style={[styles.board, { width, height: WHITE_H }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: whites }).map((_, index) => {
          const pitch = WHITE_PITCHES[index % 7]
          return (
            <View
              key={`white-${index}`}
              style={[
                styles.white,
                { left: index * WHITE_W },
                isActive(pitch) && styles.whiteActive,
                isRoot(pitch) && styles.keyRoot,
                isBass(pitch) && styles.keyBass,
              ]}
            />
          )
        })}

        {Array.from({ length: OCTAVES }).map((_, octave) =>
          BLACK_KEYS.map(({ pitch, afterWhite }) => (
            <View
              key={`black-${octave}-${pitch}`}
              style={[
                styles.black,
                { left: (octave * 7 + afterWhite + 1) * WHITE_W - BLACK_W / 2 },
                isActive(pitch) && styles.blackActive,
                isRoot(pitch) && styles.keyRoot,
                isBass(pitch) && styles.keyBass,
              ]}
            />
          )),
        )}
      </View>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    wrap: { alignItems: "center" },
    board: { position: "relative" },
    white: {
      position: "absolute",
      top: 0,
      width: WHITE_W,
      height: WHITE_H,
      borderWidth: 1,
      borderColor: Theme.colors.border,
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 4,
      backgroundColor: Theme.colors.surfaceHigh,
    },
    whiteActive: { backgroundColor: Theme.colors.primarySoft },
    black: {
      position: "absolute",
      top: 0,
      width: BLACK_W,
      height: BLACK_H,
      zIndex: 2,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 4,
      backgroundColor: Theme.colors.background,
    },
    blackActive: { backgroundColor: Theme.colors.primary },
    keyRoot: { borderWidth: 2, borderColor: Theme.colors.primary },
    keyBass: { borderWidth: 2, borderColor: Theme.colors.accent },
  })

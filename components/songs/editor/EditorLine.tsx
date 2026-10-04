import React, { useRef, useState } from "react"
import { Pressable, StyleSheet, TextInput, View } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button, IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { AddIcon, TrashIcon } from "@/components/ui/Icons"
import {
  nextWordStart,
  previousWordStart,
  snapToWordStart,
  wordStarts,
} from "@/libs/chords"
import { moveChord, normalizeChords, setChordAt } from "@/libs/songUtils"
import type { ChordPosition, LyricLine } from "@/interfaces"
import { ChordPadContent } from "@/components/songs/editor/ChordPad"
import { buildChordRow } from "@/components/songs/ChordLine"

interface EditorLineProps {
  line: LyricLine
  lineIndex: number
  sectionLabel: string
  songKey: string
  fontSize: number
  onChange: (next: LyricLine) => void
  onDelete: () => void
}

interface PadState {
  position: number
  chord: string
  /** False while adding a new chord (no move/remove actions). */
  existing: boolean
}

/**
 * One lyric line of the chord editor.
 *
 * The caret position decides where a new chord lands, snapped to the closest
 * word start: that is what makes "add a chord at this exact position" feel
 * natural with a finger (docs §10).
 */
export function EditorLine({
  line,
  lineIndex,
  sectionLabel,
  songKey,
  fontSize,
  onChange,
  onDelete,
}: EditorLineProps) {
  const styles = useThemedStyles(createStyles)
  const caret = useRef(line.text.length)
  const [pad, setPad] = useState<PadState | null>(null)

  const chords = normalizeChords(line.chords, line.text.length)

  const readWebCaret = (fallback: number): number => {
    if (typeof document === "undefined") return fallback
    const active = document.activeElement
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      if (typeof active.selectionStart === "number") return active.selectionStart
    }
    return fallback
  }

  const resolveInsertPosition = (requested: number): number => {
    const base = Math.max(0, Math.min(requested, line.text.length))
    const anchors = Array.from(new Set([...wordStarts(line.text), line.text.length]))
      .filter((value) => value >= 0 && value <= line.text.length)
      .sort((a, b) => a - b)
    const taken = new Set(chords.map((entry) => entry.position))
    const forward = anchors.find((anchor) => anchor >= base && !taken.has(anchor))
    if (forward !== undefined) return forward
    const firstFree = anchors.find((anchor) => !taken.has(anchor))
    if (firstFree !== undefined) return firstFree
    if (!taken.has(base)) return base
    if (!taken.has(line.text.length)) return line.text.length
    return base
  }

  /** Keeps chords glued to their word while the lyrics are edited. */
  const handleText = (text: string): void => {
    caret.current = text.length
    onChange({
      text,
      chords: normalizeChords(
        chords.map((chord) => ({
          ...chord,
          position: Math.min(chord.position, text.length),
        })),
        text.length,
      ),
    })
  }

  const applyChord = (chord: string): void => {
    if (!pad) return
    const position = pad.position
    onChange({
      ...line,
      chords: setChordAt(chords, position, chord, line.text.length),
    })
    caret.current = nextWordStart(line.text, position)
    setPad(null)
  }

  const shiftChord = (position: number, direction: 1 | -1): void => {
    const chord = chords.find((entry) => entry.position === position)
    if (!chord) return
    const target =
      direction === 1
        ? snapToWordStart(line.text, nextWordStart(line.text, position))
        : snapToWordStart(line.text, previousWordStart(line.text, position))
    onChange({
      ...line,
      chords: moveChord(chords, position, target, line.text.length),
    })
  }

  const removeChord = (position: number): void => {
    onChange({
      ...line,
      chords: setChordAt(chords, position, "", line.text.length),
    })
    setPad(null)
  }

  return (
    <View style={styles.row}>
      <View style={styles.chipRow}>
        <Pressable
          onPressIn={() => {
            caret.current = readWebCaret(caret.current)
          }}
          onPress={() =>
            setPad({
              position: resolveInsertPosition(readWebCaret(caret.current)),
              chord: "",
              existing: false,
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`Add a chord to line ${lineIndex + 1} of ${sectionLabel}`}
          style={({ pressed }) => [styles.addChip, pressed && styles.pressed]}
        >
          <AddIcon size={13} color={Theme.colors.primary} />
          <AppText variant="caption" tone="primary">
            Add chord
          </AppText>
        </Pressable>

        {chords.map((chord) => (
          <Pressable
            key={`${chord.position}-${chord.chord}`}
            onPress={() =>
              setPad({
                position: chord.position,
                chord: chord.chord,
                existing: true,
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`Edit chord ${chord.chord} above ${describeAnchor(line.text, chord.position)}`}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <AppText
              style={[
                styles.chipText,
                { fontSize: Math.max(11, fontSize - 6) },
              ]}
              tone="accent"
            >
              {chord.chord}
            </AppText>
          </Pressable>
        ))}
      </View>

      {chords.length > 0 ? (
        <View style={styles.preview}>
          <AppText
            style={[styles.previewText, { fontSize: Math.max(12, fontSize - 4) }]}
            tone="muted"
          >
            {buildChordRow(chords, line.text)}
          </AppText>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          value={line.text}
          onChangeText={handleText}
          onSelectionChange={(event) => {
            caret.current = event.nativeEvent.selection.start
          }}
          placeholder="Type or paste a lyric line…"
          placeholderTextColor={Theme.colors.textFaint}
          selectionColor={Theme.colors.primary}
          accessibilityLabel={`Lyrics for line ${lineIndex + 1} of ${sectionLabel}`}
          style={[styles.input, { fontSize: Math.max(14, fontSize - 3) }]}
        />
        <IconButton
          label={`Delete line ${lineIndex + 1} of ${sectionLabel}`}
          size={34}
          variant="danger"
          onPress={onDelete}
          icon={<TrashIcon size={16} color={Theme.colors.danger} />}
        />
      </View>

      <Dialog
        visible={pad !== null}
        onClose={() => setPad(null)}
        title={pad?.existing ? "Edit chord" : "Add chord"}
        description={`${sectionLabel} · line ${lineIndex + 1}${
          pad ? ` · above “${describeAnchor(line.text, pad.position)}”` : ""
        }`}
        hideActions
      >
        {pad ? (
          <ChordPadContent
            initialChord={pad.chord}
            songKey={songKey}
            onPick={applyChord}
            onCancel={() => setPad(null)}
            header={
              pad.existing ? (
                <View style={styles.padActions}>
                  <Button
                    label="Move left"
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      shiftChord(pad.position, -1)
                      setPad(null)
                    }}
                  />
                  <Button
                    label="Move right"
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      shiftChord(pad.position, 1)
                      setPad(null)
                    }}
                  />
                  <Button
                    label="Remove"
                    variant="danger"
                    size="sm"
                    onPress={() => removeChord(pad.position)}
                  />
                </View>
              ) : undefined
            }
          />
        ) : null}
      </Dialog>
    </View>
  )
}

/** Short description of what a chord is anchored to, for screen readers. */
const describeAnchor = (text: string, position: number): string => {
  const word = text.slice(position).split(/\s/)[0] ?? ""
  return word.length > 0 ? word : "the end of the line"
}

export type { ChordPosition }

const createStyles = () =>
  StyleSheet.create({
    row: {
      gap: Theme.spacing.s,
      paddingVertical: Theme.spacing.s,
      paddingHorizontal: Theme.spacing.m,
      borderRadius: Theme.radii.m,
      backgroundColor: Theme.colors.background2,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
    },
    addChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: Theme.spacing.s,
      paddingVertical: 4,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.primarySoft,
    },
    chip: {
      paddingHorizontal: Theme.spacing.s,
      paddingVertical: 4,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.accentSoft,
    },
    chipText: { fontFamily: Theme.fonts.mono },
    preview: {
      paddingHorizontal: Theme.spacing.s,
      paddingVertical: Theme.spacing.xs,
      borderRadius: Theme.radii.s,
      backgroundColor: Theme.colors.surface,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
    },
    previewText: { fontFamily: Theme.fonts.mono },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
    },
    input: {
      flex: 1,
      color: Theme.colors.text,
      fontFamily: Theme.fonts.mono,
      paddingVertical: Theme.spacing.s,
      paddingHorizontal: Theme.spacing.s,
      borderRadius: Theme.radii.s,
      backgroundColor: Theme.colors.surface,
      borderWidth: 1,
      borderColor: Theme.colors.border,
    },
    pressed: { opacity: 0.7 },
    padActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Theme.spacing.s,
    },
  })

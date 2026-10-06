import React, { useEffect, useRef, useState } from "react"
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button, IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { AddIcon, TrashIcon } from "@/components/ui/Icons"
import {
  buildChordRow,
  chordAnchors,
  chordPositionLimit,
  normalizeChords,
  reanchorChords,
  setChordAt,
  shiftChordByCharacter,
  shiftChordToAnchor,
} from "@/libs/songUtils"
import type { ChordPosition, LyricLine } from "@/interfaces"
import { ChordPadContent } from "@/components/songs/editor/ChordPad"

interface EditorLineProps {
  line: LyricLine
  lineIndex: number
  sectionLabel: string
  songKey: string
  fontSize: number
  onChange: (next: LyricLine) => void
  onDelete: () => void
  /** Enter pressed: the editor adds a fresh line below this one. */
  onSubmit?: () => void
  /** Takes the focus as soon as the line mounts (used by the new line). */
  autoFocus?: boolean
  onFocused?: () => void
}

interface PadState {
  position: number
  chord: string
  /** False while adding a new chord (no move/remove actions). */
  existing: boolean
}

/**
 * One line of the chord editor.
 *
 * Chords land **exactly where the cursor is** — including inside a word — and
 * stay glued to that character while the lyrics are edited (docs §10). If the
 * cursor already sits on a chord, tapping “Add chord” opens it for editing.
 * Lines without lyrics — intros, instrumentals, riffs — are treated as a
 * **chord progression**: chords are appended in order and reordered by
 * swapping, so no placeholder words are needed.
 */
export function EditorLine({
  line,
  lineIndex,
  sectionLabel,
  songKey,
  fontSize,
  onChange,
  onDelete,
  onSubmit,
  autoFocus = false,
  onFocused,
}: EditorLineProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const inputRef = useRef<TextInput>(null)
  const caret = useRef(line.text.length)
  const [pad, setPad] = useState<PadState | null>(null)

  // A line created by pressing Enter takes the focus straight away, so the
  // lyric keeps flowing without touching anything else.
  useEffect(() => {
    if (!autoFocus) return
    inputRef.current?.focus()
    onFocused?.()
  }, [autoFocus, onFocused])

  const chordOnly = line.text.trim().length === 0
  const limit = chordPositionLimit(line.text)
  const chords = normalizeChords(line.chords, limit)
  // The chord preview and the lyric field must share font family, size and
  // padding: the preview is a monospace row padded to each character column, so
  // any difference in metrics shows up as misaligned chords.
  const lyricFontSize = Math.max(14, fontSize - 3)

  const readWebCaret = (fallback: number): number => {
    if (typeof document === "undefined") return fallback
    const active = document.activeElement
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      if (typeof active.selectionStart === "number") return active.selectionStart
    }
    return fallback
  }

  const resolveInsertPosition = (requested: number): number => {
    // A progression only grows: the next chord goes after the last one.
    if (chordOnly) {
      return chords.reduce((max, entry) => Math.max(max, entry.position), -1) + 1
    }
    // Exact cursor position: a chord can sit in the middle of a word.
    return Math.max(0, Math.min(requested, line.text.length))
  }

  /**
   * Keeps chords glued to the character they sit on while the lyrics are
   * edited, so free placement never drifts. The two transitions are handled
   * explicitly: clearing the lyrics turns the chords into a numbered
   * progression, and typing them back spreads the progression over the new
   * line in order.
   */
  const handleText = (text: string): void => {
    caret.current = text.length
    const becomesChordOnly = text.trim().length === 0
    const next = becomesChordOnly
      ? chords.map((chord, index) => ({
          ...chord,
          position: chordOnly ? chord.position : index,
        }))
      : chordOnly
        ? (() => {
            const anchors = chordAnchors(text)
            return chords.map((chord, index) => ({
              ...chord,
              position: anchors[Math.min(index, anchors.length - 1)] ?? 0,
            }))
          })()
        : reanchorChords(chords, line.text, text)

    onChange({ text, chords: normalizeChords(next, chordPositionLimit(text)) })
  }

  const applyChord = (chord: string): void => {
    if (!pad) return
    onChange({
      ...line,
      chords: setChordAt(chords, pad.position, chord, limit),
    })
    setPad(null)
  }

  const shiftChord = (position: number, direction: 1 | -1): void => {
    // A progression has no characters: "left/right" swaps it with the previous
    // or next chord. With lyrics the move is character-exact, so a chord placed
    // in the middle of a word can be nudged without snapping to the word.
    const next = chordOnly
      ? shiftChordToAnchor(
          chords,
          position,
          chords.map((entry) => entry.position),
          direction,
          limit,
        )
      : shiftChordByCharacter(chords, position, direction, limit)
    if (next === chords) return
    onChange({ ...line, chords: next })
  }

  const removeChord = (position: number): void => {
    onChange({
      ...line,
      chords: setChordAt(chords, position, "", limit),
    })
    setPad(null)
  }

  const addChip = (
    <Pressable
      onPressIn={() => {
        caret.current = readWebCaret(caret.current)
      }}
      onPress={() => {
        const position = resolveInsertPosition(readWebCaret(caret.current))
        // The cursor is on an existing chord: edit that one instead.
        const existing = chords.find((entry) => entry.position === position)
        setPad(
          existing
            ? { position, chord: existing.chord, existing: true }
            : { position, chord: "", existing: false },
        )
      }}
      accessibilityRole="button"
      accessibilityLabel={
        chordOnly
          ? t("songs.addNextChord", { section: sectionLabel, line: lineIndex + 1 })
          : t("songs.addChordToLine", { line: lineIndex + 1, section: sectionLabel })
      }
      style={({ pressed }) => [styles.addChip, pressed && styles.pressed]}
    >
      <AddIcon size={13} color={Theme.colors.primary} />
      <AppText variant="caption" tone="primary">
        {t("songs.addChord")}
      </AppText>
    </Pressable>
  )

  return (
    <View style={styles.row}>
      <View style={styles.chipRow}>
        {chordOnly ? null : addChip}

        {chords.map((chord) => {
          const word = wordAt(line.text, chord.position)
          return (
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
              accessibilityLabel={
                word
                  ? t("songs.changeToWord", { chord: chord.chord, word })
                  : t("songs.changeAtEnd", { chord: chord.chord })
              }
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
          )
        })}

        {chordOnly ? addChip : null}
      </View>

      {chords.length > 0 && !chordOnly ? (
        <View style={styles.preview}>
          <AppText
            style={[styles.previewText, { fontSize: lyricFontSize, lineHeight: Math.round(lyricFontSize * 1.4) }]}
            tone="muted"
          >
            {buildChordRow(chords, line.text)}
          </AppText>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          value={line.text}
          onChangeText={handleText}
          onSelectionChange={(event) => {
            caret.current = event.nativeEvent.selection.start
          }}
          onSubmitEditing={() => onSubmit?.()}
          // Enter adds the next line; keep the keyboard up and let the editor
          // move the focus (react-native-web still uses `blurOnSubmit`).
          blurOnSubmit={Platform.OS === "web" ? false : undefined}
          submitBehavior={Platform.OS === "web" ? undefined : "submit"}
          placeholder={chordOnly ? t("songs.optionalLyric") : t("songs.lyricPlaceholder")}
          placeholderTextColor={Theme.colors.textFaint}
          selectionColor={Theme.colors.primary}
          accessibilityLabel={t("songs.lineLabel", {
            section: sectionLabel,
            line: lineIndex + 1,
          })}
          accessibilityHint={t("songs.pressEnterHint")}
          style={[styles.input, { fontSize: lyricFontSize }]}
        />
        <IconButton
          label={t("songs.deleteLine", { line: lineIndex + 1, section: sectionLabel })}
          size={34}
          variant="danger"
          onPress={onDelete}
          icon={<TrashIcon size={16} color={Theme.colors.danger} />}
        />
      </View>

      <Dialog
        visible={pad !== null}
        onClose={() => setPad(null)}
        title={pad?.existing ? t("songs.editChord") : t("songs.addChord")}
        description={
          pad && !chordOnly
            ? t("songs.lineAbove", {
                section: sectionLabel,
                line: lineIndex + 1,
                anchor: wordAt(line.text, pad.position) || t("songs.endOfLine"),
              })
            : t("songs.lineLabel", { section: sectionLabel, line: lineIndex + 1 })
        }
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
                    label={t("songs.moveLeft")}
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      shiftChord(pad.position, -1)
                      setPad(null)
                    }}
                  />
                  <Button
                    label={t("songs.moveRight")}
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      shiftChord(pad.position, 1)
                      setPad(null)
                    }}
                  />
                  <Button
                    label={t("common.remove")}
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

/** Word the chord sits on, for screen readers and pad descriptions. */
const wordAt = (text: string, position: number): string => {
  if (text.length === 0 || position >= text.length) return ""
  let start = position
  while (start > 0 && !/\s/.test(text[start - 1] ?? " ")) start -= 1
  let end = position
  while (end < text.length && !/\s/.test(text[end] ?? " ")) end += 1
  return text.slice(start, end)
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

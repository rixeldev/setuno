import React, { useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button, IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import {
  AddIcon,
  ArrowDownIcon,
  ArrowUpwardIcon,
  MusicIcon,
  TrashIcon,
} from "@/components/ui/Icons"
import { EditorLine } from "@/components/songs/editor/EditorLine"
import {
  SECTION_TYPES,
  countSongChords,
  countSongLines,
  createSection,
  emptyLine,
  normalizeSectionLabels,
  parseLyricBlock,
  sectionLabel,
  sectionLabelFor,
  transposeSections,
} from "@/libs/songUtils"
import { transposeChord, transposeKey } from "@/libs/chords"
import type { SongSection, SongSectionType } from "@/interfaces"

interface SongEditorProps {
  sections: SongSection[]
  onChange: (sections: SongSection[]) => void
  songKey: string
  fontSize: number
}

/**
 * The chord/lyric editor (docs §10, §41).
 *
 * Sections are the outer structure, lines the inner one and chords are anchored
 * to character offsets inside a line, so nothing is ever limited to a fixed
 * number of chords per line.
 */
export function SongEditor({
  sections,
  onChange,
  songKey,
  fontSize,
}: SongEditorProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const [sectionToDelete, setSectionToDelete] = useState<SongSection | null>(
    null,
  )
  const [typePicker, setTypePicker] = useState<{ index: number } | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [transposeOpen, setTransposeOpen] = useState(false)
  const [semitones, setSemitones] = useState(2)
  const [pasteText, setPasteText] = useState("")
  const [pasteMode, setPasteMode] = useState<"replace" | "append">("replace")
  // Line that must take the focus after pressing Enter on the line above.
  const [focusTarget, setFocusTarget] = useState<{ sectionId: string; lineIndex: number } | null>(null)

  const lineCount = useMemo(() => countSongLines(sections), [sections])
  const chordCount = useMemo(() => countSongChords(sections), [sections])

  const updateSection = (index: number, next: SongSection): void => {
    onChange(
      sections.map((section, position) =>
        position === index ? next : section,
      ),
    )
  }

  const moveSection = (index: number, direction: -1 | 1): void => {
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    const next = [...sections]
    const current = next[index]
    const swapped = next[target]
    if (!current || !swapped) return
    next[index] = swapped
    next[target] = current
    onChange(next)
  }

  const addSection = (type: SongSectionType): void => {
    const sameType =
      sections.filter((section) => section.type === type).length + 1
    onChange([
      ...sections,
      createSection(type, sectionLabel(type, sameType), [emptyLine()]),
    ])
  }

  /** Enter on a line: a fresh editable line appears right below it. */
  const addLineAfter = (sectionIndex: number, lineIndex: number): void => {
    const section = sections[sectionIndex]
    if (!section) return
    const lines = [...section.lines]
    lines.splice(lineIndex + 1, 0, emptyLine())
    onChange(
      sections.map((entry, index) =>
        index === sectionIndex ? { ...section, lines } : entry,
      ),
    )
    setFocusTarget({ sectionId: section.id, lineIndex: lineIndex + 1 })
  }

  const applyPaste = (): void => {
    const parsed = parseLyricBlock(pasteText)
    if (parsed.length === 0) return
    onChange(
      pasteMode === "replace"
        ? parsed
        : normalizeSectionLabels([...sections, ...parsed]),
    )
    setPasteOpen(false)
    setPasteText("")
  }

  const applyTranspose = (): void => {
    onChange(transposeSections(sections, semitones))
    setTransposeOpen(false)
  }

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <MusicIcon size={14} color={Theme.colors.textFaint} />
        <AppText variant="caption" tone="faint">
          {t("songs.summary", { sections: sections.length, lines: lineCount, chords: chordCount })}
        </AppText>
      </View>

      {chordCount === 0 ? (
        <AppText variant="caption" tone="muted">
          {t("songs.placeCursorHint")}
        </AppText>
      ) : null}

      {sections.map((section, index) => (
        <View key={section.id} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Pressable
              onPress={() => setTypePicker({ index })}
              accessibilityRole="button"
              accessibilityLabel={t("songs.changeSection", {
                section: sectionLabelFor(sections, index, t),
              })}
              style={({ pressed }) => [
                styles.typeButton,
                pressed && styles.pressed,
              ]}
            >
              <AppText variant="label" tone="primary">
                {sectionLabelFor(sections, index, t)}
              </AppText>
            </Pressable>

            <View style={styles.sectionActions}>
              <IconButton
                label={t("songs.moveSectionUp", { section: sectionLabelFor(sections, index, t) })}
                size={32}
                onPress={() => moveSection(index, -1)}
                disabled={index === 0}
                icon={
                  <ArrowUpwardIcon size={15} color={Theme.colors.textMuted} />
                }
              />
              <IconButton
                label={t("songs.moveSectionDown", { section: sectionLabelFor(sections, index, t) })}
                size={32}
                onPress={() => moveSection(index, 1)}
                disabled={index === sections.length - 1}
                icon={
                  <ArrowDownIcon size={15} color={Theme.colors.textMuted} />
                }
              />
              <IconButton
                label={t("songs.deleteSectionA11y", { section: sectionLabelFor(sections, index, t) })}
                size={32}
                variant="danger"
                onPress={() => setSectionToDelete(section)}
                icon={<TrashIcon size={15} color={Theme.colors.danger} />}
              />
            </View>
          </View>

          <View style={styles.lines}>
            {section.lines.map((line, lineIndex) => (
              <EditorLine
                key={`${section.id}-${lineIndex}`}
                line={line}
                lineIndex={lineIndex}
                sectionLabel={sectionLabelFor(sections, index, t)}
                songKey={songKey}
                fontSize={fontSize}
                onSubmit={() => addLineAfter(index, lineIndex)}
                autoFocus={
                  focusTarget?.sectionId === section.id &&
                  focusTarget.lineIndex === lineIndex
                }
                onFocused={() => setFocusTarget(null)}
                onChange={(next) => {
                  const lines = section.lines.map((entry, position) =>
                    position === lineIndex ? next : entry,
                  )
                  updateSection(index, { ...section, lines })
                }}
                onDelete={() => {
                  const lines = section.lines.filter(
                    (_, position) => position !== lineIndex,
                  )
                  updateSection(index, {
                    ...section,
                    lines:
                      lines.length > 0
                        ? lines
                        : // Never leave a section without a line: keep it editable.
                          [emptyLine()],
                  })
                }}
              />
            ))}
          </View>

          <Button
            label={t("songs.addLine")}
            variant="subtle"
            size="sm"
            icon={<AddIcon size={14} color={Theme.colors.primary} />}
            onPress={() =>
              updateSection(index, {
                ...section,
                lines: [...section.lines, emptyLine()],
              })
            }
            style={styles.addLine}
          />
        </View>
      ))}

      {/* Song-wide actions live at the end: adding the next section happens
          right where the user finished writing, without scrolling back up. */}
      <View style={styles.toolbar}>
        <Button
          label={t("songs.addSection")}
          variant="secondary"
          size="sm"
          icon={<AddIcon size={15} color={Theme.colors.text} />}
          onPress={() => setTypePicker({ index: -1 })}
          style={styles.tool}
        />
        <Button
          label={t("songs.pasteLyrics")}
          variant="secondary"
          size="sm"
          onPress={() => setPasteOpen(true)}
          style={styles.tool}
        />
        <Button
          label={t("songs.transpose")}
          variant="secondary"
          size="sm"
          onPress={() => {
            setSemitones(2)
            setTransposeOpen(true)
          }}
          style={styles.tool}
        />
      </View>

      <Dialog
        visible={typePicker !== null}
        onClose={() => setTypePicker(null)}
        title={
          typePicker?.index === -1 ? t("songs.addSection") : t("songs.changeSectionType")
        }
        hideActions
      >
        <ScrollView style={styles.typeScroll}>
          <View style={styles.typeGrid}>
            {SECTION_TYPES.map((entry) => (
              <Pressable
                key={entry.type}
                accessibilityRole="button"
                accessibilityLabel={t(entry.i18n)}
                onPress={() => {
                  const picker = typePicker
                  if (picker?.index === -1) {
                    addSection(entry.type)
                  } else if (picker) {
                    const section = sections[picker.index]
                    if (section) {
                      onChange(
                        normalizeSectionLabels(
                          sections.map((entry2, position) =>
                            position === picker.index
                              ? { ...entry2, type: entry.type }
                              : entry2,
                          ),
                        ),
                      )
                    }
                  }
                  setTypePicker(null)
                }}
                style={({ pressed }) => [
                  styles.typeChip,
                  pressed && styles.pressed,
                ]}
              >
                <AppText variant="bodyStrong">{t(entry.i18n)}</AppText>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </Dialog>

      <Dialog
        visible={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title={t("songs.pasteLyrics")}
        description={t("songs.pasteDescription")}
        confirmLabel={t("songs.insert")}
        onConfirm={applyPaste}
        confirmDisabled={pasteText.trim().length === 0}
      >
        <Input
          label={t("songs.lyrics")}
          value={pasteText}
          onChangeText={setPasteText}
          multiline
          placeholder={t("songs.pastePlaceholder")}
          autoCapitalize="sentences"
        />
        <View style={styles.modeRow}>
          {(["replace", "append"] as const).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityState={{ selected: pasteMode === mode }}
              onPress={() => setPasteMode(mode)}
              style={({ pressed }) => [
                styles.modeChip,
                pasteMode === mode && styles.modeChipActive,
                pressed && styles.pressed,
              ]}
            >
              <AppText
                variant="caption"
                tone={pasteMode === mode ? "primary" : "muted"}
              >
                {mode === "replace" ? t("songs.replaceLyrics") : t("songs.appendToExisting")}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Dialog>

      <Dialog
        visible={transposeOpen}
        onClose={() => setTransposeOpen(false)}
        title={t("songs.transposeTitle")}
        description={t("songs.transposeDescription")}
        confirmLabel={t("songs.transpose")}
        onConfirm={applyTranspose}
        confirmDisabled={semitones === 0}
      >
        <View style={styles.transposeBox}>
          <AppText variant="display" tone="primary">
            {semitones > 0 ? `+${semitones}` : semitones}
          </AppText>
          <AppText variant="caption" tone="muted">
            {t(semitones >= 0 ? "songs.transposeUp" : "songs.transposeDown", {
              semitones: Math.abs(semitones),
            })}
          </AppText>
        </View>
        <View style={styles.transposeButtons}>
          <Button
            label={t("songs.down")}
            variant="secondary"
            onPress={() => setSemitones((value) => Math.max(-11, value - 1))}
            style={styles.tool}
          />
          <Button
            label={t("songs.up")}
            variant="secondary"
            onPress={() => setSemitones((value) => Math.min(11, value + 1))}
            style={styles.tool}
          />
        </View>
        <View style={styles.transposePreview}>
          <AppText variant="caption" tone="faint">
            {t("songs.key")} {songKey || "—"} → {transposeKey(songKey, semitones) || "—"} · G
            → {transposeChord("G", semitones)} · Em7 →{" "}
            {transposeChord("Em7", semitones)}
          </AppText>
        </View>
      </Dialog>

      <Dialog
        visible={sectionToDelete !== null}
        onClose={() => setSectionToDelete(null)}
        title={t("songs.deleteSectionConfirm", {
          section:
            sectionToDelete &&
            sections.findIndex((entry) => entry.id === sectionToDelete.id) >= 0
              ? sectionLabelFor(
                  sections,
                  sections.findIndex((entry) => entry.id === sectionToDelete.id),
                  t,
                )
              : t("songs.sectionFallback"),
        })}
        description={t("songs.deleteSectionDescription")}
        confirmLabel={t("songs.deleteSectionLabel")}
        tone="danger"
        onConfirm={() => {
          if (sectionToDelete) {
            onChange(
              sections.filter((section) => section.id !== sectionToDelete.id),
            )
          }
          setSectionToDelete(null)
        }}
      />
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    container: { gap: Theme.spacing.m },
    summary: { flexDirection: "row", alignItems: "center", gap: 6 },
    section: {
      gap: Theme.spacing.s,
      padding: Theme.spacing.m,
      borderRadius: Theme.radii.xl,
      backgroundColor: Theme.colors.surface,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.s,
    },
    typeButton: {
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: 5,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.primarySoft,
    },
    sectionActions: { flexDirection: "row", gap: 4 },
    lines: { gap: Theme.spacing.s },
    addLine: { alignSelf: "flex-start" },
    toolbar: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.s },
    tool: { flexGrow: 1, flexBasis: 120 },
    pressed: { opacity: 0.7 },
    typeScroll: { maxHeight: 320 },
    typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.s },
    typeChip: {
      paddingHorizontal: Theme.spacing.l,
      paddingVertical: Theme.spacing.m,
      borderRadius: Theme.radii.m,
      backgroundColor: Theme.colors.surfaceHigh,
      borderWidth: 1,
      borderColor: Theme.colors.border,
    },
    modeRow: { flexDirection: "row", gap: Theme.spacing.s },
    modeChip: {
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: 7,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.surfaceHigh,
      borderWidth: 1,
      borderColor: Theme.colors.border,
    },
    modeChipActive: {
      backgroundColor: Theme.colors.primarySoft,
      borderColor: Theme.colors.primary,
    },
    transposeBox: { alignItems: "center", gap: 2 },
    transposeButtons: { flexDirection: "row", gap: Theme.spacing.m },
    transposePreview: { alignItems: "center" },
  })

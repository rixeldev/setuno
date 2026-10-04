import React, { useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { AddIcon, CloseIcon, SearchIcon } from "@/components/ui/Icons"
import { COMMON_CHORDS, diatonicChords, looksLikeChord, normalizeChordInput } from "@/libs/chords"

interface ChordPadContentProps {
  /** Chord highlighted as the current selection. */
  initialChord?: string
  /** Shows the diatonic chords of this key at the top of the palette. */
  songKey?: string
  onPick: (chord: string) => void
  onCancel: () => void
  /** Rendered above the palette (move/delete actions when editing). */
  header?: React.ReactNode
}

/**
 * Chord picker content: searchable palette of common chords, the diatonic
 * chords of the current key, plus a custom field for anything else
 * (7ths, sus, add, slash chords...).
 */
export function ChordPadContent({
  initialChord = "",
  songKey,
  onPick,
  onCancel,
  header,
}: ChordPadContentProps) {
  const styles = useThemedStyles(createStyles)
  const [search, setSearch] = useState(initialChord)
  const [custom, setCustom] = useState("")
  const [customError, setCustomError] = useState<string | null>(null)

  const diatonic = useMemo(() => diatonicChords(songKey ?? ""), [songKey])
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase()
    const palette = Array.from(new Set([...diatonic, ...COMMON_CHORDS]))
    if (term.length === 0) return palette
    return palette.filter((chord) => chord.toLowerCase().includes(term))
  }, [diatonic, search])

  const pickCustom = (): void => {
    const normalized = normalizeChordInput(custom)
    if (!looksLikeChord(normalized)) {
      setCustomError("Type a chord such as C, F#m7 or G/B.")
      return
    }
    onPick(normalized)
  }

  return (
    <View style={styles.body}>
      {header}

      <Input
        label="Search chords"
        value={search}
        onChangeText={setSearch}
        placeholder="Filter the palette, or type a chord"
        autoCapitalize="none"
        autoCorrect={false}
        icon={<SearchIcon size={16} color={Theme.colors.textFaint} />}
        right={
          search.length > 0 ? (
            <Pressable
              onPress={() => setSearch("")}
              hitSlop={Theme.hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Clear chord search"
            >
              <CloseIcon size={14} color={Theme.colors.textFaint} />
            </Pressable>
          ) : undefined
        }
      />

      {diatonic.length > 0 && search.trim().length === 0 ? (
        <View style={styles.block}>
          <AppText variant="label" tone="faint">
            In {songKey}
          </AppText>
          <View style={styles.wrap}>
            {diatonic.map((chord) => (
              <ChordKey
                key={`dia-${chord}`}
                chord={chord}
                highlighted
                onPress={onPick}
                label={`Use chord ${chord}, in key ${songKey}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.block}>
        <AppText variant="label" tone="faint">
          Common chords
        </AppText>
        <ScrollView style={styles.scroll} nestedScrollEnabled>
          <View style={styles.wrap}>
            {matches.map((chord) => (
              <ChordKey
                key={chord}
                chord={chord}
                selected={chord === initialChord}
                onPress={onPick}
                label={`Use chord ${chord}`}
              />
            ))}
            {matches.length === 0 ? (
              <AppText variant="caption" tone="faint">
                No chords match “{search}”. Add it as a custom chord below.
              </AppText>
            ) : null}
          </View>
        </ScrollView>
      </View>

      <Input
        label="Custom chord"
        value={custom}
        onChangeText={(value) => {
          setCustom(value)
          setCustomError(null)
        }}
        error={customError}
        placeholder="F#m7, G/B, Bbmaj7…"
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={pickCustom}
      />
      <View style={styles.footer}>
        <Button
          label="Use custom chord"
          variant="secondary"
          icon={<AddIcon size={16} color={Theme.colors.text} />}
          onPress={pickCustom}
          disabled={custom.trim().length === 0}
          style={styles.footerButton}
        />
        <Button label="Cancel" variant="ghost" onPress={onCancel} style={styles.footerButton} />
      </View>
    </View>
  )
}

interface ChordPadProps extends Omit<ChordPadContentProps, "header"> {
  visible: boolean
  onDismiss: () => void
  title?: string
  description?: string
}

/** Chord picker wrapped in a dialog (song editor, suggestion forms). */
export function ChordPad({
  visible,
  onDismiss,
  title = "Choose a chord",
  description,
  initialChord,
  songKey,
  onPick,
}: ChordPadProps) {
  const styles = useThemedStyles(createStyles)
  return (
    <Dialog visible={visible} onClose={onDismiss} title={title} description={description} hideActions>
      <View style={styles.dialogBody}>
        <ChordPadContent
          initialChord={initialChord}
          songKey={songKey}
          onPick={onPick}
          onCancel={onDismiss}
        />
      </View>
    </Dialog>
  )
}

function ChordKey({
  chord,
  onPress,
  highlighted = false,
  selected = false,
  label,
}: {
  chord: string
  onPress: (chord: string) => void
  highlighted?: boolean
  selected?: boolean
  label: string
}) {
  const styles = useThemedStyles(createStyles)
  return (
    <Pressable
      onPress={() => onPress(chord)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chord,
        highlighted && styles.chordHighlighted,
        selected && styles.chordSelected,
        pressed && styles.chordPressed,
      ]}
    >
      <AppText variant="bodyStrong" tone={selected ? "inverse" : highlighted ? "primary" : "default"}>
        {chord}
      </AppText>
    </Pressable>
  )
}

const createStyles = () =>
  StyleSheet.create({
    body: { gap: Theme.spacing.m },
    dialogBody: { maxHeight: 520 },
    block: { gap: Theme.spacing.s },
    scroll: { maxHeight: 180 },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.s },
    chord: {
      minWidth: 58,
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: Theme.spacing.s,
      borderRadius: Theme.radii.m,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.surfaceHigh,
      alignItems: "center",
    },
    chordHighlighted: {
      borderColor: Theme.colors.primary,
      backgroundColor: Theme.colors.primarySoft,
    },
    chordSelected: {
      backgroundColor: Theme.colors.primary,
      borderColor: Theme.colors.primary,
    },
    chordPressed: { opacity: 0.7 },
    footer: { flexDirection: "row", gap: Theme.spacing.m },
    footerButton: { flex: 1 },
  })

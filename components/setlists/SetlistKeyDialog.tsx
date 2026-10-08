import React from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { Dialog } from "@/components/ui/Dialog"
import { Chip } from "@/components/ui/Card"
import { MAJOR_KEYS, MINOR_KEYS, displayKey } from "@/libs/chords"
import { usePreferences } from "@/services/prefs"

interface SetlistKeyDialogProps {
  visible: boolean
  /** Song whose play key is being chosen. */
  songTitle: string
  /** Key the song is written in, shown as a hint. */
  originalKey: string
  /** Key currently chosen for this setlist entry. */
  value: string
  onClose: () => void
  onSelect: (key: string) => void
}

/**
 * Chooses the key a song will be played in inside one setlist (docs §20).
 * Stored on the setlist entry only — the songbook keeps its original key — and
 * synced to every member through the setlist listener.
 */
export function SetlistKeyDialog({
  visible,
  songTitle,
  originalKey,
  value,
  onClose,
  onSelect,
}: SetlistKeyDialogProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  // Keys are stored in letters; the reader settings decide how they spell out.
  const notation = usePreferences().chordNotation ?? "letters"
  const options = [...MAJOR_KEYS, ...MINOR_KEYS]

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={songTitle}
      description={t("setlists.playKeyDescription", {
        key: originalKey ? displayKey(originalKey, notation) : "—",
      })}
    >
      <View style={styles.options}>
        {options.map((key) => (
          <Chip
            key={key}
            label={displayKey(key, notation)}
            tone="accent"
            selected={value === key}
            onPress={() => onSelect(key)}
          />
        ))}
      </View>
    </Dialog>
  )
}

const createStyles = () =>
  StyleSheet.create({
    options: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.s },
  })

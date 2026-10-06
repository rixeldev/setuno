import React from "react"
import { Pressable, StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { ChevronRightIcon } from "@/components/ui/Icons"

interface SongNavArrowsProps {
  /** Previous song in the running order (null at the start). */
  previousId: string | null
  /** Next song in the running order (null at the end). */
  nextId: string | null
  onNavigate: (songId: string) => void
}

/**
 * Fixed corner arrows to move through the running order while reading a song
 * that belongs to an event's setlist. Floating over the content, away from the
 * chords, and each one only appears when there is somewhere to go.
 */
export function SongNavArrows({ previousId, nextId, onNavigate }: SongNavArrowsProps) {
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const bottom = insets.bottom + Theme.spacing.l

  return (
    <>
      {previousId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("songs.previousSong")}
          onPress={() => onNavigate(previousId)}
          style={({ pressed }) => [
            styles.arrow,
            { bottom, left: insets.left + Theme.spacing.l },
            pressed && styles.pressed,
          ]}
        >
          <ChevronRightIcon size={22} color={Theme.colors.text} style={styles.flipped} />
        </Pressable>
      ) : null}

      {nextId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("songs.nextSong")}
          onPress={() => onNavigate(nextId)}
          style={({ pressed }) => [
            styles.arrow,
            { bottom, right: insets.right + Theme.spacing.l },
            pressed && styles.pressed,
          ]}
        >
          <ChevronRightIcon size={22} color={Theme.colors.text} />
        </Pressable>
      ) : null}
    </>
  )
}

const createStyles = () =>
  StyleSheet.create({
    arrow: {
      position: "absolute",
      width: 48,
      height: 48,
      borderRadius: Theme.radii.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.surface,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      ...Theme.shadows.sm,
      opacity: 0.95,
    },
    flipped: { transform: [{ rotate: "180deg" }] },
    pressed: { opacity: 0.7 },
  })

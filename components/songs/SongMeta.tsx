import React from "react"
import { StyleSheet, View } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"

/**
 * The one-line facts about a song (artist, tempo, length, genre) as small
 * pills instead of a run of middot-separated text.
 *
 * The reader used to print them as a single faint caption above the lyrics,
 * which read as body copy and made the top of the song look like a document.
 * Pills give every fact its own boundary, so the eye skips them and lands on
 * the first chord — and a song with only an artist stays a single pill.
 */
export function SongMeta({ facts }: { facts: readonly string[] }) {
  const styles = useThemedStyles(createStyles)

  if (facts.length === 0) return null

  return (
    <View style={styles.row}>
      {facts.map((fact, index) => (
        <View key={`${index}-${fact}`} style={styles.pill}>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {fact}
          </AppText>
        </View>
      ))}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    pill: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.background2,
    },
  })

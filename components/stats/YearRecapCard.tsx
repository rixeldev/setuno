import React from "react"
import { StyleSheet, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useTranslation } from "react-i18next"

import { Theme, colorWithOpacity } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { MusicIcon } from "@/components/ui/Icons"
import type { YearRecap } from "@/libs/bandStats"

interface YearRecapCardProps {
  bandName: string
  year: number
  recap: YearRecap
}

/**
 * The shareable year-in-review card (roadmap #35). It is deliberately a fixed,
 * self-contained layout with **no remote images**: `react-native-view-shot`
 * captures the native view (html2canvas does the same on the web), and a card
 * that never waits on the network or a CORS header cannot fail to rasterise
 * mid-share. The gradient and every colour come from the theme, so the card
 * follows dark/light mode like the rest of the app.
 */
export function YearRecapCard({ bandName, year, recap }: YearRecapCardProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()

  const cells = [
    { key: "shows", value: recap.shows, label: t("stats.cardShows") },
    { key: "songs", value: recap.songsPlayed, label: t("stats.cardSongs") },
    { key: "minutes", value: recap.minutes, label: t("stats.cardMinutes") },
    { key: "new", value: recap.newSongs, label: t("stats.cardNewSongs") },
  ]

  return (
    <LinearGradient
      colors={[...Theme.gradients.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.head}>
        <AppText variant="subheading" tone="inverse" numberOfLines={2} style={styles.flex}>
          {bandName}
        </AppText>
        <AppText variant="display" tone="inverse">
          {year}
        </AppText>
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => (
          <View key={cell.key} style={styles.cell}>
            <AppText variant="title" tone="inverse">
              {cell.value}
            </AppText>
            <AppText variant="caption" tone="inverse" numberOfLines={1} style={styles.dim}>
              {cell.label}
            </AppText>
          </View>
        ))}
      </View>

      {recap.topSong ? (
        <View style={styles.mostPlayed}>
          <MusicIcon size={16} color={Theme.colors.onPrimary} />
          <View style={styles.flex}>
            <AppText variant="caption" tone="inverse" style={styles.dim} numberOfLines={1}>
              {t("stats.cardMostPlayed")}
            </AppText>
            <AppText variant="bodyStrong" tone="inverse" numberOfLines={1}>
              {recap.topSong.title}
            </AppText>
          </View>
          <AppText variant="caption" tone="inverse">
            {recap.topSong.timesPlayed}×
          </AppText>
        </View>
      ) : null}

      <AppText variant="caption" tone="inverse" style={styles.brand}>
        Setuno
      </AppText>
    </LinearGradient>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      borderRadius: Theme.radii.xl,
      padding: Theme.spacing.xl,
      gap: Theme.spacing.l,
      overflow: "hidden",
    },
    head: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Theme.spacing.m,
    },
    flex: { flex: 1, minWidth: 0 },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: Theme.spacing.m,
    },
    cell: { width: "47%", gap: 2 },
    // Dimmed whites keep the big number the loudest thing in each cell.
    dim: { color: colorWithOpacity(Theme.colors.onPrimary, 0.82) },
    mostPlayed: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      borderTopWidth: 1,
      borderTopColor: colorWithOpacity(Theme.colors.onPrimary, 0.28),
      paddingTop: Theme.spacing.m,
    },
    brand: {
      color: colorWithOpacity(Theme.colors.onPrimary, 0.7),
      textAlign: "right",
    },
  })

import React from "react"
import { StyleSheet, View } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Card } from "@/components/ui/Card"
import type { ComponentType } from "react"

interface StatTileProps {
  label: string
  value: string | number
  hint?: string
  icon?: ComponentType<{ size?: number; color?: string }>
  onPress?: () => void
  tone?: "default" | "primary"
}

/** Compact metric tile used on the dashboard (docs §17). */
export function StatTile({ label, value, hint, icon: Icon, onPress, tone = "default" }: StatTileProps) {
  const styles = useThemedStyles(createStyles)
  return (
    <Card
      padded={false}
      onPress={onPress}
      accessibilityLabel={`${label}: ${value}${hint ? `. ${hint}` : ""}`}
      style={[styles.tile, tone === "primary" && styles.tilePrimary]}
    >
      <View style={styles.tileHeader}>
        <AppText variant="label" tone="faint" numberOfLines={1}>
          {label}
        </AppText>
        {Icon ? <Icon size={15} color={Theme.colors.textFaint} /> : null}
      </View>
      <AppText variant="title" tone={tone === "primary" ? "primary" : "default"}>
        {value}
      </AppText>
      {hint ? (
        <AppText variant="caption" tone="faint" numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </Card>
  )
}

/** Two/three column responsive row of stat tiles. */
export function StatRow({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles)
  return <View style={styles.row}>{children}</View>
}

const createStyles = () =>
  StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.m },
    tile: { flexGrow: 1, flexBasis: 150, gap: 4, padding: Theme.spacing.l, minHeight: 100 },
    tilePrimary: { borderColor: Theme.colors.primary },
    tileHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  })
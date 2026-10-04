import React from "react"
import { StyleSheet, View } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card } from "@/components/ui/Card"
import { MapPinIcon } from "@/components/ui/Icons"
import { dayStamp, formatRelativeDay, formatTime } from "@/libs/format"
import { parseIsoDate } from "@/libs/validation"
import { PERFORMANCE_STATUS_LABELS } from "@/interfaces"
import type { Performance, PerformanceStatus } from "@/interfaces"

export const PERFORMANCE_STATUS_TONES: Record<PerformanceStatus, "primary" | "success" | "danger"> = {
  scheduled: "primary",
  completed: "success",
  cancelled: "danger",
}

interface CardProps {
  performance: Performance
  onPress: () => void
}

/** Full row used on the shows list. */
export function PerformanceCard({ performance, onPress }: CardProps) {
  const styles = useThemedStyles(createStyles)

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${performance.name}, ${formatRelativeDay(parseIsoDate(performance.date))}`}
      style={{ gap: Theme.spacing.s }}
    >
      <View style={styles.row}>
        <View style={styles.dateBlock}>
          <AppText variant="caption" tone="muted">
            {dayStamp(parseIsoDate(performance.date)).weekday}
          </AppText>
          <AppText variant="subheading" tone="primary">
            {dayStamp(parseIsoDate(performance.date)).day}
          </AppText>
        </View>

        <View style={styles.flex}>
          <AppText variant="subheading" numberOfLines={1}>
            {performance.name}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {[
              formatRelativeDay(parseIsoDate(performance.date)),
              performance.startTime ? formatTime(performance.startTime) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </AppText>
          {performance.venue.name || performance.setlistName ? (
            <AppText variant="caption" tone="faint" numberOfLines={1}>
              {[performance.venue.name, performance.setlistName].filter(Boolean).join(" · ")}
            </AppText>
          ) : null}
        </View>

        <Badge
          label={PERFORMANCE_STATUS_LABELS[performance.status]}
          tone={PERFORMANCE_STATUS_TONES[performance.status]}
        />
      </View>

      {performance.venue.address ? (
        <View style={styles.venue}>
          <MapPinIcon size={13} color={Theme.colors.textFaint} />
          <AppText variant="caption" tone="faint" numberOfLines={1} style={styles.flex}>
            {performance.venue.address}
          </AppText>
        </View>
      ) : null}
    </Card>
  )
}

/** Compact row used on the calendar screen. */
export function PerformanceListRow({ performance, onPress }: CardProps) {
  const styles = useThemedStyles(createStyles)

  return (
    <Card
      onPress={onPress}
      padded={false}
      style={styles.compact}
      accessibilityLabel={`${performance.name}, ${formatRelativeDay(parseIsoDate(performance.date))}`}
    >
      <View style={styles.compactRow}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {performance.name}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {[
              performance.startTime ? formatTime(performance.startTime) : null,
              performance.venue.name || null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </AppText>
        </View>
        <Badge
          label={PERFORMANCE_STATUS_LABELS[performance.status]}
          tone={PERFORMANCE_STATUS_TONES[performance.status]}
        />
      </View>
    </Card>
  )
}

const createStyles = () =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    flex: { flex: 1, minWidth: 0 },
    dateBlock: {
      minWidth: 58,
      alignItems: "center",
      gap: 1,
      paddingVertical: 6,
      paddingHorizontal: Theme.spacing.s,
      borderRadius: Theme.radii.m,
      backgroundColor: Theme.colors.primarySoft,
    },
    venue: { flexDirection: "row", alignItems: "center", gap: 6 },
    compact: { overflow: "hidden" },
    compactRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      padding: Theme.spacing.m,
    },
  })
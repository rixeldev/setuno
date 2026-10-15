import React from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"

interface DayCellProps {
  /** Day number to show. */
  day: number
  /** The `yyyy-mm-dd` this cell stands for, handed back on press. */
  iso: string
  /** Renders faintly: a day that belongs to the neighbouring month. */
  outside?: boolean
  /** How many shows the day holds — drives the dot. */
  count: number
  selected: boolean
  /** Draws the ring around today, which is not the same as being selected. */
  today: boolean
  /** The cell's full accessible name; only the parent knows the locale. */
  label: string
  onSelect: (iso: string) => void
}

/**
 * One selectable day — the circle, the show dot and the press target — shared
 * by the month grid and the week strip (roadmap #51), so both read identically
 * and neither can drift from the other.
 */
export function DayCell({
  day,
  iso,
  outside = false,
  count,
  selected,
  today,
  label,
  onSelect,
}: DayCellProps) {
  const styles = useThemedStyles(createStyles)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => onSelect(iso)}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.circle,
          selected && styles.circleSelected,
          today && !selected && styles.circleToday,
        ]}
      >
        <AppText variant="caption" tone={selected ? "inverse" : outside ? "faint" : "default"}>
          {day}
        </AppText>
      </View>

      <View style={styles.dots}>
        {count > 0 ? (
          <View
            style={[styles.dot, count > 1 && styles.dotStrong, selected && styles.dotSelected]}
          />
        ) : null}
      </View>
    </Pressable>
  )
}

const createStyles = () =>
  StyleSheet.create({
    cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3, gap: 3 },
    circle: {
      width: 34,
      height: 34,
      borderRadius: Theme.radii.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    circleSelected: { backgroundColor: Theme.colors.primary },
    circleToday: { borderWidth: 1, borderColor: Theme.colors.primary },
    dots: { height: 6, flexDirection: "row", gap: 2 },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Theme.colors.accent },
    dotStrong: { backgroundColor: Theme.colors.primary },
    dotSelected: { backgroundColor: Theme.colors.onPrimary },
    pressed: { opacity: 0.7 },
  })

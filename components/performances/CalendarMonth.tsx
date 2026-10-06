import React, { useMemo } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { ChevronRightIcon } from "@/components/ui/Icons"
import { startOfDay } from "@/libs/format"

const toIso = (date: Date): string =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`

interface CalendarMonthProps {
  /** Any date inside the month to render. */
  month: Date
  /** Selected day as `yyyy-mm-dd`. */
  selected: string | null
  /** Number of shows per `yyyy-mm-dd`. */
  counts: Record<string, number>
  onShiftMonth: (delta: number) => void
  onSelectDay: (iso: string) => void
}

interface Cell {
  iso: string
  day: number
  inMonth: boolean
}

/**
 * Month grid with show markers (docs §23). Reused by the calendar screen and
 * stays keyboard/screen-reader friendly: each day is a labelled button.
 */
export function CalendarMonth({
  month,
  selected,
  counts,
  onShiftMonth,
  onSelectDay,
}: CalendarMonthProps) {
  const { t, i18n } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(month),
    [i18n.language, month],
  )
  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language, { weekday: "short" })
    // 2024-01-01 was a Monday, which matches the Monday-first grid below.
    return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 0, 1 + index)))
  }, [i18n.language])

  const cells = useMemo<Cell[]>(() => {
    const year = month.getFullYear()
    const monthIndex = month.getMonth()
    const first = startOfDay(new Date(year, monthIndex, 1, 12))
    const leading = (first.getDay() + 6) % 7
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    const daysInPrev = new Date(year, monthIndex, 0).getDate()

    const result: Cell[] = []
    for (let index = leading - 1; index >= 0; index -= 1) {
      result.push({
        iso: toIso(new Date(year, monthIndex - 1, daysInPrev - index, 12)),
        day: daysInPrev - index,
        inMonth: false,
      })
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      result.push({ iso: toIso(new Date(year, monthIndex, day, 12)), day, inMonth: true })
    }
    let next = 1
    while (result.length % 7 !== 0) {
      result.push({
        iso: toIso(new Date(year, monthIndex + 1, next, 12)),
        day: next,
        inMonth: false,
      })
      next += 1
    }
    return result
  }, [month])

  const todayIso = toIso(new Date())

  return (
    <View style={styles.host}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.previousMonth")}
          onPress={() => onShiftMonth(-1)}
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
        >
          <ChevronRightIcon
            size={18}
            color={Theme.colors.textMuted}
            style={{ transform: [{ rotate: "180deg" }] }}
          />
        </Pressable>

        <AppText variant="subheading" accessibilityRole="header">
          {monthLabel}
        </AppText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.nextMonth")}
          onPress={() => onShiftMonth(1)}
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
        >
          <ChevronRightIcon size={18} color={Theme.colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {weekdayLabels.map((day, index) => (
          <AppText key={`${day}-${index}`} variant="caption" tone="faint" style={styles.cell}>
            {day}
          </AppText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => {
          const count = counts[cell.iso] ?? 0
          const isSelected = cell.iso === selected
          const isToday = cell.iso === todayIso
          return (
            <Pressable
              key={cell.iso}
              accessibilityRole="button"
              accessibilityLabel={count > 0 ? t("calendar.dayShows", { count, date: cell.iso }) : t("calendar.dayNoShows", { date: cell.iso })}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelectDay(cell.iso)}
              style={({ pressed }) => [styles.cellButton, pressed && styles.pressed]}
            >
              <View
                style={[
                  styles.dayCircle,
                  isSelected && styles.daySelected,
                  isToday && !isSelected && styles.dayToday,
                ]}
              >
                <AppText
                  variant="caption"
                  tone={isSelected ? "inverse" : cell.inMonth ? "default" : "faint"}
                >
                  {cell.day}
                </AppText>
              </View>

              <View style={styles.dots}>
                {count > 0 ? (
                  <View
                    style={[
                      styles.dot,
                      count > 1 && styles.dotStrong,
                      isSelected && styles.dotSelected,
                    ]}
                  />
                ) : null}
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: { gap: Theme.spacing.s },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Theme.spacing.s },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: Theme.radii.s,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.background2,
    },
    weekRow: { flexDirection: "row" },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    cell: { width: `${100 / 7}%`, textAlign: "center" },
    cellButton: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3, gap: 3 },
    dayCircle: {
      width: 34,
      height: 34,
      borderRadius: Theme.radii.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    daySelected: { backgroundColor: Theme.colors.primary },
    dayToday: { borderWidth: 1, borderColor: Theme.colors.primary },
    dots: { height: 6, flexDirection: "row", gap: 2 },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Theme.colors.accent },
    dotStrong: { backgroundColor: Theme.colors.primary },
    dotSelected: { backgroundColor: Theme.colors.onPrimary },
    pressed: { opacity: 0.7 },
  })
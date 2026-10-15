import React, { useMemo } from "react"
import { Pressable, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { ChevronRightIcon } from "@/components/ui/Icons"
import { DayCell } from "@/components/performances/DayCell"
import { calendarChromeStyles } from "@/components/performances/calendarStyles"
import { weekDays, weekStartIso, weekdayLabels } from "@/libs/calendarView"
import { parseIsoDate, toIsoDate } from "@/libs/validation"

interface CalendarWeekProps {
  /** Any date inside the week to render. */
  day: Date
  /** Selected day as `yyyy-mm-dd`. */
  selected: string | null
  /** Number of shows per `yyyy-mm-dd`. */
  counts: Record<string, number>
  onShiftWeek: (delta: number) => void
  onSelectDay: (iso: string) => void
}

/**
 * One week as a single row (roadmap #51): seven days with their show dots,
 * under a header that names the range. It is the month grid's first row, made
 * the whole screen — the agenda below it then lists the same seven days.
 *
 * The week always starts on Monday, matching the month grid above it; nothing
 * here follows the locale's first-day rule, because a band week is a fixed shape
 * and a grid that changed its first column between views would be worse than
 * one that never does.
 */
export function CalendarWeek({
  day,
  selected,
  counts,
  onShiftWeek,
  onSelectDay,
}: CalendarWeekProps) {
  const { t, i18n } = useTranslation()
  const styles = useThemedStyles(calendarChromeStyles)

  const start = weekStartIso(toIsoDate(day))
  const days = useMemo(() => weekDays(start), [start])
  const labels = useMemo(() => weekdayLabels(i18n.language), [i18n.language])
  const range = useMemo(() => {
    const first = parseIsoDate(days[0] ?? "")
    const last = parseIsoDate(days[6] ?? "")
    if (!first || !last) return ""
    const formatter = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" })
    return t("calendar.weekOf", { range: `${formatter.format(first)} – ${formatter.format(last)}` })
  }, [days, i18n.language, t])

  const todayIso = toIsoDate(new Date())

  return (
    <View style={styles.host}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.previousWeek")}
          onPress={() => onShiftWeek(-1)}
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
        >
          <ChevronRightIcon
            size={18}
            color={Theme.colors.textMuted}
            style={{ transform: [{ rotate: "180deg" }] }}
          />
        </Pressable>

        <AppText variant="subheading" accessibilityRole="header">
          {range}
        </AppText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.nextWeek")}
          onPress={() => onShiftWeek(1)}
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
        >
          <ChevronRightIcon size={18} color={Theme.colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {labels.map((label, index) => (
          <AppText key={`${label}-${index}`} variant="caption" tone="faint" style={styles.cellLabel}>
            {label}
          </AppText>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((iso, index) => {
          const date = parseIsoDate(iso)
          const count = counts[iso] ?? 0
          return (
            <DayCell
              key={iso}
              day={date?.getDate() ?? index + 1}
              iso={iso}
              count={count}
              selected={iso === selected}
              today={iso === todayIso}
              label={
                count > 0 ?
                  t("calendar.dayShows", { count, date: iso })
                : t("calendar.dayNoShows", { date: iso })
              }
              onSelect={onSelectDay}
            />
          )
        })}
      </View>
    </View>
  )
}

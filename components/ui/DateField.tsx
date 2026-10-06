import React, { useCallback, useMemo, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { CalendarIcon, ChevronRightIcon } from "@/components/ui/Icons"
import { formatRelativeDay, startOfDay, type RelativeDayLabels } from "@/libs/format"
import { ISO_DATE_PATTERN } from "@/libs/validation"

const toIso = (date: Date): string =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`

interface DateFieldProps {
  label?: string
  /** Selected day as `yyyy-mm-dd`, or null. */
  value: string | null
  onChange: (iso: string) => void
  error?: string | null
  minimumDate?: Date
  maximumDate?: Date
  placeholder?: string
}

interface Cell {
  iso: string
  day: number
  inMonth: boolean
  disabled: boolean
}

/**
 * Cross-platform calendar field.
 *
 * Built in-app (instead of the native date picker) so the same component works
 * on Android and on Web, and so the visual language matches the rest of the
 * design system (docs §4, §21).
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  minimumDate,
  maximumDate,
  placeholder,
}: DateFieldProps) {
  const styles = useThemedStyles(createStyles)
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const placeholderText = placeholder ?? t("common.pickDate")

  const selected = value && ISO_DATE_PATTERN.test(value) ? new Date(`${value}T12:00:00`) : null
  const [cursor, setCursor] = useState<Date>(() => selected ?? new Date())

  // Dates are formatted with the platform Intl data, so the calendar follows
  // the selected language without hardcoding month or weekday names.
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(cursor),
    [cursor, i18n.language],
  )
  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language, { weekday: "narrow" })
    // 2024-01-01 was a Monday, which matches the Monday-first grid below.
    return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 0, 1 + index)))
  }, [i18n.language])
  const dayLabels: RelativeDayLabels = {
    today: t("common.today"),
    tomorrow: t("common.tomorrow"),
    yesterday: t("common.yesterday"),
  }

  const monthStart = useMemo(
    () => new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12),
    [cursor],
  )

  // Resolved to timestamps once so the grid can memoise on primitives.
  const minimumTime = useMemo(
    () => (minimumDate ? startOfDay(minimumDate).getTime() : null),
    [minimumDate],
  )
  const maximumTime = useMemo(
    () => (maximumDate ? startOfDay(maximumDate).getTime() : null),
    [maximumDate],
  )

  const isDisabled = useCallback(
    (date: Date): boolean => {
      const time = startOfDay(date).getTime()
      if (minimumTime !== null && time < minimumTime) return true
      if (maximumTime !== null && time > maximumTime) return true
      return false
    },
    [minimumTime, maximumTime],
  )

  const cells = useMemo<Cell[]>(() => {
    const first = startOfDay(monthStart)
    // Monday-first grid: JS weeks start on Sunday, so shift by 6 for Mondays.
    const leading = (first.getDay() + 6) % 7
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    const daysInPrev = new Date(cursor.getFullYear(), cursor.getMonth(), 0).getDate()
    const result: Cell[] = []

    for (let index = leading - 1; index >= 0; index -= 1) {
      const day = daysInPrev - index
      const date = new Date(cursor.getFullYear(), cursor.getMonth() - 1, day, 12)
      result.push({ iso: toIso(date), day, inMonth: false, disabled: isDisabled(date) })
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), day, 12)
      result.push({ iso: toIso(date), day, inMonth: true, disabled: isDisabled(date) })
    }
    while (result.length % 7 !== 0) {
      const day = result.length - leading - daysInMonth + 1
      const date = new Date(cursor.getFullYear(), cursor.getMonth() + 1, day, 12)
      result.push({ iso: toIso(date), day, inMonth: false, disabled: isDisabled(date) })
    }
    return result
  }, [cursor, monthStart, isDisabled])

  const shiftMonth = (delta: number): void => {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1, 12))
  }

  const displayLabel = value ? formatRelativeDay(selected, dayLabels) : placeholderText

  return (
    <View style={{ gap: 6 }}>
      {label ? <AppText variant="caption" tone="muted">{label}</AppText> : null}

      <View style={[styles.trigger, error && styles.triggerError]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value ? `${displayLabel}. ${t("common.changeDate")}` : placeholderText}
          onPress={() => {
            setCursor(selected ?? new Date())
            setOpen(true)
          }}
          style={({ pressed }) => [styles.triggerMain, pressed && styles.pressed]}
        >
          <CalendarIcon size={16} color={error ? Theme.colors.danger : Theme.colors.textFaint} />
          <AppText variant="body" tone={value ? "default" : "faint"} style={styles.triggerText}>
            {displayLabel}
          </AppText>
        </Pressable>
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.clearDate")}
            onPress={() => onChange("")}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <AppText variant="caption" tone="faint">
              {t("common.clear")}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}

      <Dialog
        visible={open}
        onClose={() => setOpen(false)}
        title={label ?? t("common.chooseDate")}
        hideActions
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.previousMonth")}
            onPress={() => shiftMonth(-1)}
            style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
          >
            <ChevronRightIcon
              size={18}
              color={Theme.colors.textMuted}
              style={{ transform: [{ rotate: "180deg" }] }}
            />
          </Pressable>
          <AppText variant="subheading">{monthLabel}</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.nextMonth")}
            onPress={() => shiftMonth(1)}
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
            const isSelected = cell.iso === value
            return (
              <Pressable
                key={cell.iso}
                accessibilityRole="button"
                accessibilityLabel={cell.iso}
                accessibilityState={{ selected: isSelected, disabled: cell.disabled }}
                disabled={cell.disabled}
                onPress={() => {
                  onChange(cell.iso)
                  setOpen(false)
                }}
                style={({ pressed }) => [
                  styles.cellButton,
                  isSelected && styles.cellSelected,
                  pressed && !cell.disabled && styles.pressed,
                ]}
              >
                <AppText
                  variant="body"
                  tone={isSelected ? "inverse" : cell.inMonth ? "default" : "faint"}
                >
                  {cell.day}
                </AppText>
              </Pressable>
            )
          })}
        </View>

        <Button
          label={t("common.today")}
          variant="ghost"
          onPress={() => {
            onChange(toIso(new Date()))
            setOpen(false)
          }}
        />
      </Dialog>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    trigger: {
      flexDirection: "row",
      alignItems: "stretch",
      minHeight: 46,
      paddingHorizontal: Theme.spacing.l,
      borderRadius: Theme.radii.m,
      borderWidth: 1,
      borderColor: Theme.colors.border,
      backgroundColor: Theme.colors.surface,
    },
    triggerMain: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
    },
    triggerError: { borderColor: Theme.colors.danger },
    triggerText: { flex: 1 },
    // Sibling of the main press target: nesting buttons breaks web hydration.
    clear: { alignItems: "center", justifyContent: "center", paddingLeft: Theme.spacing.m },
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
    cell: { width: `${100 / 7}%`, textAlign: "center", paddingVertical: 4 },
    cellButton: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    cellSelected: { backgroundColor: Theme.colors.primary, borderRadius: Theme.radii.s },
    pressed: { opacity: 0.7 },
  })
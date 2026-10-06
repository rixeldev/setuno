import React, { useMemo, useState } from "react"
import type { StyleProp, ViewStyle } from "react-native"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { ClockIcon } from "@/components/ui/Icons"
import { formatTime } from "@/libs/format"
import { TIME_PATTERN } from "@/libs/validation"

const pad = (value: number): string => `${value}`.padStart(2, "0")

const parseTime = (value: string | null): { hour: number; minute: number } | null => {
  if (!value || !TIME_PATTERN.test(value)) return null
  return { hour: Number(value.slice(0, 2)), minute: Number(value.slice(3, 5)) }
}

interface TimeFieldProps {
  label?: string
  /** Selected time as `HH:mm` (24h), or null. */
  value: string | null
  onChange: (time: string) => void
  error?: string | null
  placeholder?: string
  /** Minute granularity offered by the picker (default 5). */
  minuteStep?: number
  containerStyle?: StyleProp<ViewStyle>
}

/**
 * Cross-platform time picker, the clock sibling of `DateField`.
 *
 * Built in-app (hour + minute columns inside the shared `Dialog`) so the same
 * control works on Android, iOS and Web and matches the design system, instead
 * of typing the time by hand.
 */
export function TimeField({
  label,
  value,
  onChange,
  error,
  placeholder,
  minuteStep = 5,
  containerStyle,
}: TimeFieldProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const selected = parseTime(value)
  const [draftHour, setDraftHour] = useState(selected?.hour ?? new Date().getHours())
  const [draftMinute, setDraftMinute] = useState(selected?.minute ?? 0)

  const hours = useMemo(() => Array.from({ length: 24 }, (_, index) => index), [])
  const minutes = useMemo(
    () => Array.from({ length: Math.ceil(60 / minuteStep) }, (_, index) => index * minuteStep),
    [minuteStep],
  )

  const placeholderText = placeholder ?? t("common.pickTime")
  const displayLabel = selected ? formatTime(value) : placeholderText

  return (
    <View style={[styles.host, containerStyle]}>
      {label ? (
        <AppText variant="caption" tone="muted">
          {label}
        </AppText>
      ) : null}

      <View style={[styles.trigger, error && styles.triggerError]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            selected ? `${displayLabel}. ${t("common.changeTime")}` : placeholderText
          }
          onPress={() => {
            setDraftHour(selected?.hour ?? new Date().getHours())
            setDraftMinute(selected?.minute ?? 0)
            setOpen(true)
          }}
          style={({ pressed }) => [styles.triggerMain, pressed && styles.pressed]}
        >
          <ClockIcon size={16} color={error ? Theme.colors.danger : Theme.colors.textFaint} />
          <AppText variant="body" tone={selected ? "default" : "faint"} style={styles.triggerText}>
            {displayLabel}
          </AppText>
        </Pressable>
        {selected ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.clearTime")}
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
        title={label ?? t("common.chooseTime")}
        hideActions
      >
        <View style={styles.columns}>
          <View style={styles.column}>
            <AppText variant="caption" tone="faint">
              {t("common.hour")}
            </AppText>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {hours.map((entry) => (
                <Pressable
                  key={entry}
                  accessibilityRole="button"
                  accessibilityState={{ selected: entry === draftHour }}
                  onPress={() => setDraftHour(entry)}
                  style={({ pressed }) => [
                    styles.option,
                    entry === draftHour && styles.optionSelected,
                    pressed && entry !== draftHour && styles.pressed,
                  ]}
                >
                  <AppText variant="body" tone={entry === draftHour ? "inverse" : "default"}>
                    {pad(entry)}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.column}>
            <AppText variant="caption" tone="faint">
              {t("common.minute")}
            </AppText>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {minutes.map((entry) => (
                <Pressable
                  key={entry}
                  accessibilityRole="button"
                  accessibilityState={{ selected: entry === draftMinute }}
                  onPress={() => setDraftMinute(entry)}
                  style={({ pressed }) => [
                    styles.option,
                    entry === draftMinute && styles.optionSelected,
                    pressed && entry !== draftMinute && styles.pressed,
                  ]}
                >
                  <AppText variant="body" tone={entry === draftMinute ? "inverse" : "default"}>
                    {pad(entry)}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>

        <Button
          label={t("common.done")}
          onPress={() => {
            onChange(`${pad(draftHour)}:${pad(draftMinute)}`)
            setOpen(false)
          }}
        />
      </Dialog>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: { gap: 6 },
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
    columns: { flexDirection: "row", gap: Theme.spacing.m },
    column: { flex: 1, gap: 4 },
    list: {
      maxHeight: 220,
      borderRadius: Theme.radii.m,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.surface,
    },
    option: {
      minHeight: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: Theme.radii.s,
      marginHorizontal: 4,
      marginVertical: 2,
    },
    optionSelected: { backgroundColor: Theme.colors.primary },
    pressed: { opacity: 0.7 },
  })

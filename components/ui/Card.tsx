import React from "react"
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"

interface CardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  /** Adds a subtle elevated surface treatment. */
  elevated?: boolean
  onPress?: () => void
  accessibilityLabel?: string
  padded?: boolean
}

/** Surface container used for songs, setlists, performances and stats. */
export function Card({
  children,
  style,
  elevated = false,
  onPress,
  accessibilityLabel,
  padded = true,
}: CardProps) {
  const styles = useThemedStyles(createStyles)
  const content = (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        elevated && styles.elevated,
        style,
      ]}
    >
      {children}
    </View>
  )

  if (!onPress) return content

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  )
}

interface ChipProps {
  label: string
  selected?: boolean
  onPress?: () => void
  tone?: "default" | "primary" | "accent" | "danger" | "success"
  size?: "sm" | "md"
  icon?: React.ReactNode
  disabled?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

/** Compact filter/value pill (docs §19 "chips"). */
export function Chip({
  label,
  selected = false,
  onPress,
  tone = "default",
  size = "md",
  icon,
  disabled = false,
  accessibilityLabel,
  style,
}: ChipProps) {
  const styles = useThemedStyles(createStyles)
  const toneStyle = selected
    ? styles[`selected_${tone}`]
    : styles[`chip_${tone}`]

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        size === "sm" && styles.chipSmall,
        toneStyle,
        pressed && onPress ? styles.pressed : null,
        style,
      ]}
    >
      {icon}
      <AppText
        variant="caption"
        tone={selected ? TONE_BY_VARIANT[tone] : "muted"}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  )
}

const TONE_BY_VARIANT = {
  default: "default",
  primary: "primary",
  accent: "accent",
  danger: "danger",
  success: "success",
} as const

interface BadgeProps {
  label: string
  tone?: "default" | "primary" | "accent" | "danger" | "success" | "warning"
  style?: StyleProp<ViewStyle>
}

/** Status pill (pending, scheduled, admin, key...). */
export function Badge({ label, tone = "default", style }: BadgeProps) {
  const styles = useThemedStyles(createStyles)
  return (
    <View style={[styles.badge, styles[`badge_${tone}`], style]}>
      <AppText variant="caption" tone={BADGE_TONE[tone]} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  )
}

const BADGE_TONE = {
  default: "muted",
  primary: "primary",
  accent: "accent",
  danger: "danger",
  success: "success",
  warning: "accent",
} as const

interface SectionProps {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  subtitle?: string
}

/** Titled block with an optional trailing action (dashboard sections). */
export function Section({
  title,
  subtitle,
  action,
  children,
  style,
}: SectionProps) {
  const styles = useThemedStyles(createStyles)
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitles}>
          <AppText variant="heading">{title}</AppText>
          {subtitle ? (
            <AppText variant="caption" tone="muted">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  )
}

/** Horizontal rule that respects the surface colours. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useThemedStyles(createStyles)
  return <View style={[styles.divider, style]} />
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: Theme.colors.surface,
      borderRadius: Theme.radii.xl,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      overflow: "hidden",
    },
    padded: { padding: Theme.spacing.l },
    elevated: { ...Theme.shadows.sm },
    pressed: { opacity: 0.75 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: 7,
      borderRadius: Theme.radii.pill,
      borderWidth: 1,
    },
    chipSmall: { paddingHorizontal: Theme.spacing.s, paddingVertical: 4 },
    chip_default: {
      backgroundColor: Theme.colors.surfaceHigh,
      borderColor: Theme.colors.border,
    },
    chip_primary: {
      backgroundColor: Theme.colors.surfaceHigh,
      borderColor: Theme.colors.border,
    },
    chip_accent: {
      backgroundColor: Theme.colors.accentSoft,
      borderColor: "transparent",
    },
    chip_danger: {
      backgroundColor: Theme.colors.dangerSoft,
      borderColor: "transparent",
    },
    chip_success: {
      backgroundColor: Theme.colors.successSoft,
      borderColor: "transparent",
    },
    selected_default: {
      backgroundColor: Theme.colors.surfaceMuted,
      borderColor: Theme.colors.border,
    },
    selected_primary: {
      backgroundColor: Theme.colors.primarySoft,
      borderColor: Theme.colors.primary,
    },
    selected_accent: {
      backgroundColor: Theme.colors.accentSoft,
      borderColor: Theme.colors.accent,
    },
    selected_danger: {
      backgroundColor: Theme.colors.dangerSoft,
      borderColor: Theme.colors.danger,
    },
    selected_success: {
      backgroundColor: Theme.colors.successSoft,
      borderColor: Theme.colors.success,
    },
    badge: {
      paddingHorizontal: Theme.spacing.s,
      paddingVertical: 3,
      borderRadius: Theme.radii.pill,
      alignSelf: "flex-start",
    },
    badge_default: { backgroundColor: Theme.colors.surfaceMuted },
    badge_primary: { backgroundColor: Theme.colors.primarySoft },
    badge_accent: { backgroundColor: Theme.colors.accentSoft },
    badge_danger: { backgroundColor: Theme.colors.dangerSoft },
    badge_success: { backgroundColor: Theme.colors.successSoft },
    badge_warning: { backgroundColor: Theme.colors.accentSoft },
    section: { gap: Theme.spacing.m },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.m,
    },
    sectionTitles: { flex: 1, gap: 2 },
    divider: { height: 1, backgroundColor: Theme.colors.border },
  })

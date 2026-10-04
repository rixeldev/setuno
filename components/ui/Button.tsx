import React from "react"
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle"
export type ButtonSize = "sm" | "md" | "lg"

interface ButtonProps {
  label: string
  onPress?: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  full?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  style?: StyleProp<ViewStyle>
  accessibilityHint?: string
  testID?: string
}

const HEIGHTS: Record<ButtonSize, number> = { sm: 36, md: 46, lg: 54 }

/** Primary interactive control of the design system. */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  full = false,
  icon,
  iconRight,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const styles = useThemedStyles(createStyles)
  const isDisabled = disabled || loading

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHTS[size] },
        styles[variant],
        full && styles.full,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "danger" ? Theme.colors.onPrimary : Theme.colors.primary}
        />
      ) : (
        <>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <AppText
            variant={size === "sm" ? "caption" : "bodyStrong"}
            tone={TONE_BY_VARIANT[variant]}
            numberOfLines={1}
          >
            {label}
          </AppText>
          {iconRight ? <View style={styles.icon}>{iconRight}</View> : null}
        </>
      )}
    </Pressable>
  )
}

const TONE_BY_VARIANT: Record<ButtonVariant, "inverse" | "default" | "primary" | "danger" | "muted"> = {
  primary: "inverse",
  danger: "inverse",
  secondary: "default",
  ghost: "primary",
  subtle: "muted",
}

/** Square icon-only button (toolbars, list rows, editors). */
export function IconButton({
  icon,
  onPress,
  label,
  size = 40,
  variant = "ghost",
  disabled = false,
  style,
}: {
  icon: React.ReactNode
  onPress?: () => void
  /** Required for screen readers (docs §28). */
  label: string
  size?: number
  variant?: "ghost" | "secondary" | "danger"
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const styles = useThemedStyles(createStyles)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={Theme.hitSlop}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size },
        styles[`iconButton_${variant}`],
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon}
    </Pressable>
  )
}

const createStyles = () =>
  StyleSheet.create({
    base: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Theme.spacing.s,
      paddingHorizontal: Theme.spacing.xl,
      borderRadius: Theme.radii.m,
      borderWidth: 1,
    },
    full: { alignSelf: "stretch", width: "100%" },
    primary: {
      backgroundColor: Theme.colors.primary,
      borderColor: Theme.colors.primary,
    },
    secondary: {
      backgroundColor: Theme.colors.surfaceHigh,
      borderColor: Theme.colors.border,
    },
    ghost: {
      backgroundColor: "transparent",
      borderColor: "transparent",
    },
    subtle: {
      backgroundColor: Theme.colors.primarySoft,
      borderColor: "transparent",
    },
    danger: {
      backgroundColor: Theme.colors.danger,
      borderColor: Theme.colors.danger,
    },
    pressed: { opacity: Platform.OS === "web" ? 0.85 : 0.7 },
    disabled: { opacity: 0.45 },
    icon: { marginHorizontal: 2 },
    iconButton: {
      alignItems: "center",
      justifyContent: "center",
      borderRadius: Theme.radii.m,
      borderWidth: 1,
      borderColor: "transparent",
    },
    iconButton_ghost: { backgroundColor: "transparent" },
    iconButton_secondary: {
      backgroundColor: Theme.colors.surfaceHigh,
      borderColor: Theme.colors.border,
    },
    iconButton_danger: {
      backgroundColor: Theme.colors.dangerSoft,
      borderColor: "transparent",
    },
  })
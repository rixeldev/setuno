import React from "react"
import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"

export type TextVariant =
  | "display"
  | "title"
  | "heading"
  | "subheading"
  | "body"
  | "bodyStrong"
  | "caption"
  | "label"
  | "mono"

export type TextTone = "default" | "muted" | "faint" | "primary" | "accent" | "danger" | "success" | "inverse"

interface AppTextProps extends TextProps {
  variant?: TextVariant
  tone?: TextTone
  style?: StyleProp<TextStyle>
  children?: React.ReactNode
}

const TONE_COLORS: Record<TextTone, string> = {
  default: Theme.colors.text,
  muted: Theme.colors.textMuted,
  faint: Theme.colors.textFaint,
  primary: Theme.colors.primary,
  accent: Theme.colors.accent,
  danger: Theme.colors.danger,
  success: Theme.colors.success,
  inverse: Theme.colors.onPrimary,
}

/** Typography primitive: one place that owns the type scale. */
export function AppText({
  variant = "body",
  tone = "default",
  style,
  children,
  ...rest
}: AppTextProps) {
  const styles = useThemedStyles(createStyles)
  return (
    <Text
      {...rest}
      style={[styles[variant], { color: TONE_COLORS[tone] }, style]}
      // Web: disable the tap highlight so links/rows feel native to both platforms.
      suppressHighlighting
    >
      {children}
    </Text>
  )
}

const createStyles = () =>
  StyleSheet.create({
    display: {
      fontSize: Theme.sizes.hero,
      lineHeight: Theme.sizes.hero * 1.15,
      fontFamily: Theme.fonts.onestBold,
      letterSpacing: -0.8,
    },
    title: {
      fontSize: Theme.sizes.h0,
      lineHeight: Theme.sizes.h0 * 1.25,
      fontFamily: Theme.fonts.onestBold,
      letterSpacing: -0.4,
    },
    heading: {
      fontSize: Theme.sizes.h2,
      lineHeight: Theme.sizes.h2 * 1.3,
      fontFamily: Theme.fonts.onestBold,
      letterSpacing: -0.2,
    },
    subheading: {
      fontSize: Theme.sizes.h4,
      lineHeight: Theme.sizes.h4 * 1.35,
      fontFamily: Theme.fonts.onestBold,
    },
    body: {
      fontSize: Theme.sizes.h4,
      lineHeight: Theme.sizes.h4 * 1.5,
      fontFamily: Theme.fonts.onest,
    },
    bodyStrong: {
      fontSize: Theme.sizes.h4,
      lineHeight: Theme.sizes.h4 * 1.45,
      fontFamily: Theme.fonts.onestBold,
    },
    caption: {
      fontSize: Theme.sizes.h6,
      lineHeight: Theme.sizes.h6 * 1.4,
      fontFamily: Theme.fonts.onest,
    },
    label: {
      fontSize: Theme.sizes.h6,
      lineHeight: Theme.sizes.h6 * 1.2,
      fontFamily: Theme.fonts.onestBold,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    mono: {
      fontSize: Theme.sizes.h4,
      lineHeight: Theme.sizes.h4 * 1.6,
      fontFamily: Theme.fonts.mono,
    },
  })
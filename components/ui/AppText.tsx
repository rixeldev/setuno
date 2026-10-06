import React from "react"
import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from "react-native"

import { Theme, type ThemeColorKey } from "@/constants/Theme"
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

/** Tone -> palette token. Resolved per render so palettes never go stale. */
const TONE_KEYS: Record<TextTone, ThemeColorKey> = {
  default: "text",
  muted: "textMuted",
  faint: "textFaint",
  primary: "primary",
  accent: "accent",
  danger: "danger",
  success: "success",
  inverse: "onPrimary",
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
      style={[styles[variant], { color: Theme.colors[TONE_KEYS[tone]] }, style]}
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
import React from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { LinearGradient } from "expo-linear-gradient"

import { Theme, colorWithOpacity } from "@/constants/Theme"
import { useThemeVersion } from "@/services/themeManager"

/** Faint enough to keep AA text contrast on top of the wash. */
const GLOW_OPACITY = 0.1

const styles = StyleSheet.create({
  // Kept in the style (not as a prop) to stay clear of RNW deprecations.
  host: { pointerEvents: "none" },
})

interface AppBackgroundProps {
  style?: StyleProp<ViewStyle>
}

/**
 * Subtle, accent-aware gradient painted behind a screen (docs §4) instead of the
 * flat background: a soft base wash plus a faint glow of the active accent in the
 * top corner.
 *
 * The stops come from the resolved palette, so it follows light/dark mode and
 * accent changes. It is an opaque layer, which keeps stack transitions clean —
 * each screen slides with its own background instead of letting both overlap.
 */
export function AppBackground({ style }: AppBackgroundProps) {
  // Palette swaps bump the theme version; reading it keeps the stops fresh.
  useThemeVersion()

  return (
    <View style={[StyleSheet.absoluteFill, styles.host, style]}>
      <LinearGradient
        colors={[...Theme.gradients.background]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.55, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[
          colorWithOpacity(Theme.colors.primary, GLOW_OPACITY),
          colorWithOpacity(Theme.colors.primary, 0),
        ]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.15, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
}

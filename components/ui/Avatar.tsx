import React from "react"
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { initials } from "@/libs/format"

interface AvatarProps {
  name: string
  photoURL?: string | null
  size?: number
  onPress?: () => void
  /** Small online/role marker rendered on the avatar corner. */
  badge?: string | null
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

/** Circular user image with deterministic initials fallback (docs §19). */
export function Avatar({
  name,
  photoURL,
  size = 40,
  onPress,
  badge,
  style,
  accessibilityLabel,
}: AvatarProps) {
  const styles = useThemedStyles(createStyles)
  const diameter = size
  const fontSize = Math.max(10, Math.round(size * 0.38))

  const content = (
    <View
      style={[
        styles.avatar,
        { width: diameter, height: diameter, borderRadius: diameter / 2 },
        style,
      ]}
    >
      {photoURL ? (
        <Image
          source={{ uri: photoURL }}
          style={{ width: diameter, height: diameter, borderRadius: diameter / 2 }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <AppText variant="caption" style={{ fontSize, fontFamily: Theme.fonts.onestBold }}>
          {initials(name) || "?"}
        </AppText>
      )}
      {badge ? (
        <View style={[styles.badge, { backgroundColor: Theme.colors.primary }]}>
          <AppText variant="caption" tone="inverse" style={{ fontSize: Math.max(8, fontSize * 0.7) }}>
            {badge}
          </AppText>
        </View>
      ) : null}
    </View>
  )

  if (!onPress) return content

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? name}
      onPress={onPress}
      hitSlop={Theme.hitSlop}
    >
      {content}
    </Pressable>
  )
}

const createStyles = () =>
  StyleSheet.create({
    avatar: {
      alignItems: "center",
      justifyContent: "center",
      overflow: "visible",
      backgroundColor: Theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: Theme.colors.border,
    },
    badge: {
      position: "absolute",
      bottom: -2,
      right: -2,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: Theme.colors.background,
    },
  })

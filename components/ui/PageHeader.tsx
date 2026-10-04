import React from "react"
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { router } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useResponsive } from "@/hooks/useResponsive"
import { AppText } from "@/components/ui/AppText"
import { ArrowLeftIcon } from "@/components/ui/Icons"

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Shows a back affordance (hidden on root tabs). */
  back?: boolean
  onBack?: () => void
  right?: React.ReactNode
  /** Sticky styling for scrolling screens. */
  elevated?: boolean
  style?: StyleProp<ViewStyle>
  /** Large title used on the main tab screens. */
  large?: boolean
}

/**
 * Screen header used by every route: back navigation, title, subtitle and
 * actions, tuned for mobile and web (docs §4, §20).
 */
export function PageHeader({
  title,
  subtitle,
  back = false,
  onBack,
  right,
  elevated = false,
  style,
  large = false,
}: PageHeaderProps) {
  const styles = useThemedStyles(createStyles)
  const { gutter } = useResponsive()

  const handleBack = (): void => {
    if (onBack) {
      onBack()
      return
    }
    if (router.canGoBack()) router.back()
    else router.replace("/")
  }

  return (
    <View
      style={[
        styles.header,
        large && styles.headerLarge,
        elevated && styles.headerElevated,
        { paddingHorizontal: gutter },
        style,
      ]}
    >
      {back ? (
        <Pressable
          onPress={handleBack}
          hitSlop={Theme.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <ArrowLeftIcon color={Theme.colors.text} size={20} />
        </Pressable>
      ) : null}

      <View style={styles.titles}>
        <AppText variant={large ? "display" : "title"} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {right ? <View style={styles.actions}>{right}</View> : null}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingTop: Theme.spacing.m,
      paddingBottom: Theme.spacing.m,
    },
    headerLarge: {
      paddingTop: Theme.spacing.xxl,
      paddingBottom: Theme.spacing.m,
      alignItems: "flex-end",
    },
    headerElevated: {
      backgroundColor: Theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: Theme.colors.border,
      ...Platform.select({ web: { position: "sticky" as never, top: 0 }, default: {} }),
      zIndex: 20,
    },
    back: {
      width: 38,
      height: 38,
      borderRadius: Theme.radii.m,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.surfaceHigh,
    },
    pressed: { opacity: 0.7 },
    titles: { flex: 1, gap: 2, minWidth: 0 },
    actions: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
  })

import React from "react"
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { router } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useResponsive } from "@/hooks/useResponsive"
import { AppText, type TextVariant } from "@/components/ui/AppText"
import { ArrowLeftIcon } from "@/components/ui/Icons"

interface PageHeaderProps {
  title: string
  subtitle?: string
  /**
   * Back affordance. When omitted it appears automatically as soon as the
   * router has somewhere to go back to, so no screen depends on the OS gesture.
   * Pass `false` to hide it explicitly.
   */
  back?: boolean
  onBack?: () => void
  right?: React.ReactNode
  /** Bar rendered above the title (brand, page actions). */
  top?: React.ReactNode
  /** Sticky styling for scrolling screens. */
  elevated?: boolean
  style?: StyleProp<ViewStyle>
  /** Large title used on the main tab screens. */
  large?: boolean
  /**
   * Typography for the title. Defaults to `display` on large headers and
   * `title` elsewhere; dynamic titles (band names) step it down so they fit.
   */
  titleVariant?: TextVariant
  /** Lines before the title truncates. `0` means no limit. Defaults to 1. */
  titleLines?: number
}

/**
 * Screen header used by every route: back navigation, title, subtitle and
 * actions, tuned for mobile and web (docs §4, §20).
 */
export function PageHeader({
  title,
  subtitle,
  back,
  onBack,
  right,
  top,
  elevated = false,
  style,
  large = false,
  titleVariant,
  titleLines = 1,
}: PageHeaderProps) {
  const styles = useThemedStyles(createStyles)
  const { gutter, isMobile } = useResponsive()
  const { t } = useTranslation()

  const showBack = back ?? router.canGoBack()
  const titleStyle = titleVariant ?? (large ? "display" : "title")
  // Phones get a compact large title: the same size reads far bigger on a
  // narrow viewport and long names wrap into a wall of text.
  const compactDisplay = titleStyle === "display" && isMobile

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
      {top ? <View style={styles.top}>{top}</View> : null}

      <View style={[styles.titleRow, large && styles.titleRowLarge]}>
        {showBack ? (
          <Pressable
            onPress={handleBack}
            hitSlop={Theme.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t("common.goBack")}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <ArrowLeftIcon color={Theme.colors.text} size={20} />
          </Pressable>
        ) : null}

        <View style={styles.titles}>
          <AppText
            variant={titleStyle}
            style={compactDisplay ? styles.titleCompact : undefined}
            numberOfLines={titleLines > 0 ? titleLines : undefined}
          >
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
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    header: {
      gap: Theme.spacing.xs,
      paddingTop: Theme.spacing.m,
      paddingBottom: Theme.spacing.m,
    },
    headerLarge: {
      paddingTop: Theme.spacing.xxl,
      paddingBottom: Theme.spacing.m,
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.m,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
    },
    titleRowLarge: {
      alignItems: "flex-end",
    },
    headerElevated: {
      backgroundColor: Theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: Theme.colors.border,
      ...Platform.select({ web: { position: "sticky" as never, top: 0 }, default: {} }),
      zIndex: 20,
    },
    // Compact large title for phones (see `compactDisplay` above).
    titleCompact: { fontSize: 25, lineHeight: 29 },
    back: {
      width: 40,
      height: 40,
      borderRadius: Theme.radii.m,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.surfaceHigh,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
    },
    pressed: { opacity: 0.7 },
    titles: { flex: 1, gap: 2, minWidth: 0 },
    actions: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
  })

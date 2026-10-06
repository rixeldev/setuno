import React from "react"
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useResponsive } from "@/hooks/useResponsive"
import { PageHeader } from "@/components/ui/PageHeader"
import { AppBackground } from "@/components/app/AppBackground"
import type { TextVariant } from "@/components/ui/AppText"

interface ScreenContainerProps {
  children: React.ReactNode
  /** Scrolls the content (disable for screens owning their own lists). */
  scroll?: boolean
  title?: string
  subtitle?: string
  back?: boolean
  large?: boolean
  /** Typography for a dynamic title (band names). See `PageHeader`. */
  titleVariant?: TextVariant
  /** Lines before the title truncates. `0` means no limit. */
  titleLines?: number
  headerRight?: React.ReactNode
  /** Bar rendered above the header title (brand mark, page actions). */
  headerTop?: React.ReactNode
  /** Extra element rendered under the header, above the content. */
  toolbar?: React.ReactNode
  refreshing?: boolean
  onRefresh?: () => void
  /** Constrains the content width on large screens. */
  maxWidth?: number
  gap?: number
  style?: StyleProp<ViewStyle>
  /** Sticky page padding for screens without a header. */
  padded?: boolean
}

/**
 * Standard screen frame: header, responsive padding, centred content column and
 * optional pull-to-refresh (docs §21).
 */
export function ScreenContainer({
  children,
  scroll = true,
  title,
  subtitle,
  back = false,
  large = false,
  titleVariant,
  titleLines,
  headerRight,
  headerTop,
  toolbar,
  refreshing = false,
  onRefresh,
  maxWidth,
  gap = Theme.spacing.xl,
  style,
  padded = true,
}: ScreenContainerProps) {
  const styles = useThemedStyles(createStyles)
  const { gutter, contentMaxWidth } = useResponsive()
  const columnMaxWidth = maxWidth ?? contentMaxWidth

  const header =
    title || subtitle ? (
      <View style={[styles.body, { maxWidth: columnMaxWidth }]}>
        <PageHeader
          title={title ?? ""}
          subtitle={subtitle}
          back={back}
          large={large}
          titleVariant={titleVariant}
          titleLines={titleLines}
          right={headerRight}
          top={headerTop}
        />
      </View>
    ) : null

  const body = (
    <View
      style={[
        styles.body,
        padded && { paddingHorizontal: gutter },
        { gap },
        { maxWidth: columnMaxWidth },
        style,
      ]}
    >
      {toolbar}
      {children}
    </View>
  )

  if (!scroll) {
    return (
      <View style={styles.host}>
        <AppBackground />
        {header}
        {body}
      </View>
    )
  }

  return (
    <View style={styles.host}>
      <AppBackground />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === "web" ? styles.webScroll : null,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Theme.colors.primary}
              colors={[Theme.colors.primary]}
            />
          ) : undefined
        }
      >
        {header}
        <View
          style={[
            styles.body,
            padded && { paddingHorizontal: gutter },
            { gap },
            { maxWidth: columnMaxWidth },
            style,
          ]}
        >
          {toolbar}
          {children}
        </View>
      </ScrollView>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1 },
    flex: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: Theme.spacing.huge,
      ...Platform.select({ web: { maxWidth: 1180, width: "100%" as never, alignSelf: "center" as never }, default: {} }),
    },
    body: { width: "100%", alignSelf: "center" },
    webScroll: {},
  })
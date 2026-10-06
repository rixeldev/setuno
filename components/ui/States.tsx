import React, { useEffect, useState } from "react"
import { Animated, Easing, Platform, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
  compact?: boolean
}

/**
 * Friendly zero-data state: explains what to do next instead of showing an
 * empty screen (docs §24).
 */
export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact = false,
}: EmptyStateProps) {
  const styles = useThemedStyles(createStyles)
  return (
    <View style={[styles.empty, compact && styles.emptyCompact]}>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <AppText variant="heading" style={styles.centered}>
        {title}
      </AppText>
      <AppText variant="body" tone="muted" style={styles.centered}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Button label={secondaryLabel} variant="ghost" onPress={onSecondary} />
      ) : null}
    </View>
  )
}

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  compact?: boolean
}

/** Error state with a retry affordance (network, permission, offline). */
export function ErrorState({
  title,
  message,
  onRetry,
  compact = false,
}: ErrorStateProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  return (
    <View style={[styles.empty, compact && styles.emptyCompact]}>
      <View style={[styles.iconWrap, styles.iconError]}>
        <View style={styles.errorDot} />
      </View>
      <AppText variant="heading" style={styles.centered}>
        {title ?? t("common.somethingWentWrong")}
      </AppText>
      <AppText variant="body" tone="muted" style={styles.centered}>
        {message}
      </AppText>
      {onRetry ? <Button label={t("common.tryAgain")} variant="secondary" onPress={onRetry} /> : null}
    </View>
  )
}

/** Shimmerless, calm loading placeholder used while collections sync. */
export function Skeleton({
  height = 16,
  width = "100%",
  radius = Theme.radii.s,
  style,
}: {
  height?: number
  width?: number | `${number}%`
  radius?: number
  style?: object
}) {
  const pulse = useState(() => new Animated.Value(0.6))[0]

  useEffect(() => {
    if (getAnimationsDisabled()) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          height,
          width,
          borderRadius: radius,
          backgroundColor: Theme.colors.surfaceMuted,
          opacity: pulse,
        },
        style,
      ]}
    />
  )
}

/** Card-shaped skeleton used for lists (songs, setlists, performances). */
export function SkeletonList({ count = 4, height = 92 }: { count?: number; height?: number }) {
  return (
    <View style={{ gap: Theme.spacing.m }}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={{
            height,
            borderRadius: Theme.radii.xl,
            backgroundColor: Theme.colors.surface,
            borderWidth: 1,
            borderColor: Theme.colors.borderSoft,
            padding: Theme.spacing.l,
            gap: Theme.spacing.s,
          }}
        >
          <Skeleton width="55%" height={16} />
          <Skeleton width="35%" height={12} />
        </View>
      ))}
    </View>
  )
}

const getAnimationsDisabled = (): boolean =>
  typeof globalThis.matchMedia === "function" &&
  globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches

const createStyles = () =>
  StyleSheet.create({
    empty: {
      alignItems: "center",
      justifyContent: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.huge,
      paddingHorizontal: Theme.spacing.xl,
    },
    emptyCompact: { paddingVertical: Theme.spacing.xl },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.primarySoft,
      marginBottom: Theme.spacing.xs,
    },
    iconError: { backgroundColor: Theme.colors.dangerSoft },
    errorDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: Theme.colors.danger },
    centered: { textAlign: "center", maxWidth: 420 },
    action: { marginTop: Theme.spacing.s },
  })

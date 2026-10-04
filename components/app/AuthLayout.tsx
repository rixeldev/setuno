import React from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { LogoIcon } from "@/components/ui/Icons"
import { useResponsive } from "@/hooks/useResponsive"

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

/**
 * Branded, centred shell shared by the sign-in, sign-up, reset and onboarding
 * screens (docs §5, §19).
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const { isDesktop, gutter } = useResponsive()

  return (
    <KeyboardAvoidingView
      style={styles.host}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + Theme.spacing.huge, paddingBottom: insets.bottom + Theme.spacing.xl },
          { paddingHorizontal: gutter },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, isDesktop && styles.cardDesktop]}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <LogoIcon size={30} color={Theme.colors.primary} />
            </View>
            <AppText variant="title">Stage Book</AppText>
            <AppText variant="caption" tone="muted" style={styles.centered}>
              The shared chord book for your band.
            </AppText>
          </View>

          <View style={styles.header}>
            <AppText variant="display">{title}</AppText>
            {subtitle ? (
              <AppText variant="body" tone="muted" style={styles.centered}>
                {subtitle}
              </AppText>
            ) : null}
          </View>

          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1, backgroundColor: Theme.colors.background },
    scroll: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    card: { width: "100%", maxWidth: 440, gap: Theme.spacing.xxl },
    cardDesktop: { maxWidth: 480 },
    brand: { alignItems: "center", gap: Theme.spacing.s },
    logo: {
      width: 60,
      height: 60,
      borderRadius: Theme.radii.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      marginBottom: Theme.spacing.xs,
    },
    header: { gap: Theme.spacing.xs },
    body: { gap: Theme.spacing.l },
    footer: { alignItems: "center", gap: Theme.spacing.s },
    centered: { textAlign: "center" },
  })

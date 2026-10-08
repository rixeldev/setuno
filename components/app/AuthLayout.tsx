import React from "react"
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { ArrowLeftIcon } from "@/components/ui/Icons"
import { AppBackground } from "@/components/app/AppBackground"
import { useResponsive } from "@/hooks/useResponsive"

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  /** Adds the accessible go-back button on pushed auth screens. */
  back?: boolean
}

/**
 * Branded, centred shell shared by the sign-in, sign-up, reset and onboarding
 * screens (docs §5, §19).
 */
export function AuthLayout({ title, subtitle, children, footer, back = false }: AuthLayoutProps) {
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const { isDesktop, gutter } = useResponsive()
  const { t } = useTranslation()

  const handleBack = (): void => {
    if (router.canGoBack()) router.back()
    else router.replace("/(auth)/sign-in")
  }

  return (
    <KeyboardAvoidingView
      style={styles.host}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AppBackground />
      {back ? (
        <Pressable
          onPress={handleBack}
          hitSlop={Theme.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={t("common.goBack")}
          style={({ pressed }) => [
            styles.back,
            { top: insets.top + Theme.spacing.m, left: gutter },
            pressed && styles.pressed,
          ]}
        >
          <ArrowLeftIcon size={20} color={Theme.colors.text} />
        </Pressable>
      ) : null}
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
            <Image
              source={require("../../assets/icon.png")}
              style={styles.logo}
              accessibilityIgnoresInvertColors
            />
            <AppText variant="title">Setuno</AppText>
            <AppText variant="caption" tone="muted" style={styles.centered}>
              {t("auth.tagline")}
            </AppText>
          </View>

          <View style={styles.header}>
            <AppText variant="display" style={styles.centered}>
              {title}
            </AppText>
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
    host: { flex: 1 },
    back: {
      position: "absolute",
      width: 40,
      height: 40,
      borderRadius: Theme.radii.m,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.surfaceHigh,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      zIndex: 10,
    },
    pressed: { opacity: 0.7 },
    scroll: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    card: { width: "100%", maxWidth: 440, gap: Theme.spacing.xxl },
    cardDesktop: { maxWidth: 480 },
    brand: { alignItems: "center", gap: Theme.spacing.s },
    // The launcher icon doubles as the brand mark.
    logo: {
      width: 76,
      height: 76,
      borderRadius: Theme.radii.xl,
      marginBottom: Theme.spacing.xs,
    },
    header: { alignItems: "center", gap: Theme.spacing.xs },
    body: { gap: Theme.spacing.l },
    footer: { alignItems: "center", gap: Theme.spacing.s },
    centered: { textAlign: "center" },
  })

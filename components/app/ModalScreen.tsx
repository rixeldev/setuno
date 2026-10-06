import React from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useResponsive } from "@/hooks/useResponsive"
import { AppText } from "@/components/ui/AppText"
import { ArrowLeftIcon } from "@/components/ui/Icons"
import { SheetSurface } from "@/components/ui/SheetSurface"

interface ModalScreenProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  /** Extra actions rendered on the right of the header. */
  headerRight?: React.ReactNode
  /** Bar rendered above the content, under the header. */
  toolbar?: React.ReactNode
  onClose?: () => void
  gap?: number
}

/**
 * Shell for routes presented as modals (docs §21). It floats on a translucent
 * backdrop over the previous screen — a bottom sheet on phones, a dialog on
 * web/desktop — and uses the same spring entrance as `Dialog`.
 */
export function ModalScreen({
  title,
  subtitle,
  children,
  headerRight,
  toolbar,
  onClose,
  gap = Theme.spacing.l,
}: ModalScreenProps) {
  const styles = useThemedStyles(createStyles)
  const { gutter } = useResponsive()
  const { t } = useTranslation()

  const close = (): void => {
    if (onClose) {
      onClose()
      return
    }
    if (router.canGoBack()) router.back()
    else router.replace("/")
  }

  return (
    <SheetSurface visible onClose={close} placement="auto">
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <Pressable
          onPress={close}
          hitSlop={Theme.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={t("common.goBack")}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <ArrowLeftIcon size={20} color={Theme.colors.text} />
        </Pressable>

        <View style={styles.headerText}>
          <AppText variant="heading" numberOfLines={2}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" tone="muted" numberOfLines={2}>
              {subtitle}
            </AppText>
          ) : null}
        </View>

        {headerRight ? <View style={styles.headerActions}>{headerRight}</View> : null}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { gap, paddingHorizontal: gutter }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {toolbar}
        {children}
      </ScrollView>
    </SheetSurface>
  )
}

const createStyles = () =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingTop: Theme.spacing.l,
      paddingBottom: Theme.spacing.m,
      borderBottomWidth: 1,
      borderBottomColor: Theme.colors.borderSoft,
    },
    headerText: { flex: 1, gap: 2, minWidth: 0 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
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
    body: { flexShrink: 1 },
    bodyContent: { paddingTop: Theme.spacing.l, paddingBottom: Theme.spacing.xxl },
  })

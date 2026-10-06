import React from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { CheckIcon } from "@/components/ui/Icons"
import { SheetSurface } from "@/components/ui/SheetSurface"

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
}

/**
 * Cross-platform bottom sheet for short option pickers (language, theme).
 * Built on the same translucent, spring-animated surface as `Dialog`, so it
 * works identically on Android, iOS and web.
 */
export function BottomSheet({ visible, onClose, title, subtitle, children }: BottomSheetProps) {
  const styles = useThemedStyles(createStyles)

  return (
    <SheetSurface visible={visible} onClose={onClose} placement="auto">
      <View style={styles.grabber} />
      <View style={styles.content}>
        <View style={styles.header}>
          <AppText variant="heading">{title}</AppText>
          {subtitle ? (
            <AppText variant="caption" tone="muted">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <View style={styles.options}>{children}</View>
      </View>
    </SheetSurface>
  )
}

interface SheetOptionRowProps {
  label: string
  hint?: string
  selected?: boolean
  onPress: () => void
}

/** Single selectable row inside a bottom sheet. */
export function SheetOptionRow({
  label,
  hint,
  selected = false,
  onPress,
}: SheetOptionRowProps) {
  const styles = useThemedStyles(createStyles)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.optionBody}>
        <AppText variant="bodyStrong" tone={selected ? "primary" : "default"} numberOfLines={2}>
          {label}
        </AppText>
        {hint ? (
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {hint}
          </AppText>
        ) : null}
      </View>
      {selected ? <CheckIcon size={18} color={Theme.colors.primary} /> : null}
    </Pressable>
  )
}

const createStyles = () =>
  StyleSheet.create({
    grabber: {
      width: 44,
      height: 5,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.border,
      alignSelf: "center",
      marginTop: Theme.spacing.s,
    },
    content: {
      paddingHorizontal: Theme.spacing.xl,
      paddingTop: Theme.spacing.l,
      paddingBottom: Theme.spacing.xxl,
      gap: Theme.spacing.l,
    },
    header: { gap: 2 },
    options: { gap: Theme.spacing.s },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.m,
      paddingHorizontal: Theme.spacing.l,
      borderRadius: Theme.radii.lg,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.background2,
    },
    optionSelected: { backgroundColor: Theme.colors.primarySoft, borderColor: Theme.colors.primary },
    optionBody: { flex: 1, gap: 2, minWidth: 0 },
    pressed: { opacity: 0.7 },
  })

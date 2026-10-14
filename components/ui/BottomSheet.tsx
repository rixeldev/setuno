import React from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"

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
 * It slides in from the bottom edge on every platform and can be dragged back
 * down by its handle (`SheetSurface`).
 *
 * The options area scrolls when the list outgrows the sheet: the surface caps
 * at 92% of the screen and clips (`overflow: hidden`), so a sheet that grew a
 * section — the songbook's saved views plus its order list — would otherwise
 * lose its last rows off the bottom with no way to reach them. `flexShrink`
 * keeps short lists laid out exactly as before.
 */
export function BottomSheet({ visible, onClose, title, subtitle, children }: BottomSheetProps) {
  const styles = useThemedStyles(createStyles)

  return (
    <SheetSurface visible={visible} onClose={onClose} placement="bottom">
      <View style={styles.content}>
        <View style={styles.header}>
          <AppText variant="heading">{title}</AppText>
          {subtitle ? (
            <AppText variant="caption" tone="muted">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <ScrollView
          style={styles.optionsScroll}
          contentContainerStyle={styles.options}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </SheetSurface>
  )
}

interface SheetOptionRowProps {
  label: string
  hint?: string
  selected?: boolean
  onPress: () => void
  /**
   * Control rendered at the row's trailing edge, after the selection tick —
   * the songbook's saved views put a delete button there. Being its own
   * `Pressable`, it wins the touch over the row it sits in, so tapping it never
   * applies the view.
   */
  trailing?: React.ReactNode
}

/** Single selectable row inside a bottom sheet. */
export function SheetOptionRow({
  label,
  hint,
  selected = false,
  onPress,
  trailing,
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
      {trailing}
    </Pressable>
  )
}

const createStyles = () =>
  StyleSheet.create({
    content: {
      paddingHorizontal: Theme.spacing.xl,
      paddingTop: Theme.spacing.l,
      paddingBottom: Theme.spacing.xxl,
      gap: Theme.spacing.l,
    },
    header: { gap: 2 },
    /** Shrinks to the sheet's 92% cap and then scrolls its content. */
    optionsScroll: { flexShrink: 1 },
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

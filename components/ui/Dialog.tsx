import React, { useEffect, useState } from "react"
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { CloseIcon } from "@/components/ui/Icons"

interface DialogProps {
  visible: boolean
  onClose: () => void
  title: string
  description?: string
  children?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  confirmLoading?: boolean
  confirmDisabled?: boolean
  tone?: "default" | "danger"
  /** Hides the confirm button (pure information dialog). */
  hideActions?: boolean
  /**
   * Scrolls the body content. Turn it off when the body brings its own
   * scrolling list: a virtualized list inside this plain ScrollView breaks
   * windowing (React Native warns about it) and nests two scrollers.
   */
  bodyScroll?: boolean
}

/**
 * Cross-platform modal dialog used for confirmations and forms.
 * `tone="danger"` powers destructive confirmations (delete song, leave band).
 */
export function Dialog({
  visible,
  onClose,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  confirmLoading = false,
  confirmDisabled = false,
  tone = "default",
  hideActions = false,
  bodyScroll = true,
}: DialogProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const progress = useState(() => new Animated.Value(0))[0]

  useEffect(() => {
    Animated.spring(progress, {
      toValue: visible ? 1 : 0,
      useNativeDriver: Platform.OS !== "web",
      damping: 20,
      stiffness: 220,
    }).start()
  }, [progress, visible])

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] })

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        accessibilityLabel={t("common.close")}
        accessibilityRole="button"
        onPress={onClose}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.center, { pointerEvents: "box-none" }]}
      >
        <Animated.View
          style={[styles.dialog, { opacity: progress, transform: Platform.OS === "web" ? [] : [{ scale }] }]}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <AppText variant="heading">{title}</AppText>
              {description ? (
                <AppText variant="body" tone="muted">
                  {description}
                </AppText>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={Theme.hitSlop}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              style={styles.close}
            >
              <CloseIcon color={Theme.colors.textMuted} size={18} />
            </Pressable>
          </View>

          {children ? (
            bodyScroll ? (
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            ) : (
              <View style={styles.bodyStatic}>{children}</View>
            )
          ) : null}

          {hideActions ? null : (
            <View style={styles.actions}>
              <Button
                label={cancelLabel ?? t("common.cancel")}
                variant="secondary"
                onPress={onClose}
                style={styles.action}
              />
              {onConfirm && confirmLabel ? (
                <Button
                  label={confirmLabel}
                  variant={tone === "danger" ? "danger" : "primary"}
                  onPress={onConfirm}
                  loading={confirmLoading}
                  disabled={confirmDisabled}
                  style={styles.action}
                />
              ) : null}
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/** Small helper that turns a promise into confirm-button loading state. */
export const confirmLabelFor = (
  pending: boolean,
  pendingLabel: string,
  idleLabel: string,
): string => (pending ? pendingLabel : idleLabel)

const createStyles = () =>
  StyleSheet.create({
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: Theme.colors.backdrop,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: Theme.spacing.xl,
    },
    dialog: {
      width: "100%",
      maxWidth: 480,
      maxHeight: "88%",
      backgroundColor: Theme.colors.modal,
      borderRadius: Theme.radii.xl,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      padding: Theme.spacing.xl,
      gap: Theme.spacing.l,
      ...Theme.shadows.lg,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Theme.spacing.m,
    },
    headerText: { flex: 1, gap: 6 },
    close: { padding: 4 },
    body: { maxHeight: 460 },
    bodyContent: { paddingBottom: Theme.spacing.s, gap: Theme.spacing.m },
    /** Body for dialogs whose children own the scrolling (lists). */
    bodyStatic: { gap: Theme.spacing.m, flexShrink: 1 },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.m },
    // Buttons share the row when they fit (~two per line) and take the full
    // width when they do not, so labels are never squeezed into an ellipsis.
    action: { flexGrow: 1, flexShrink: 1, flexBasis: 120 },
  })

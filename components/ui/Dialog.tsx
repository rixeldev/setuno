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
  cancelLabel = "Cancel",
  onConfirm,
  confirmLoading = false,
  confirmDisabled = false,
  tone = "default",
  hideActions = false,
}: DialogProps) {
  const styles = useThemedStyles(createStyles)
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
        accessibilityLabel="Close dialog"
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
              accessibilityLabel="Close"
              style={styles.close}
            >
              <CloseIcon color={Theme.colors.textMuted} size={18} />
            </Pressable>
          </View>

          {children ? (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : null}

          {hideActions ? null : (
            <View style={styles.actions}>
              <Button label={cancelLabel} variant="secondary" onPress={onClose} style={styles.action} />
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
    actions: { flexDirection: "row", gap: Theme.spacing.m },
    action: { flex: 1 },
  })

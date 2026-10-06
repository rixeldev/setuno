import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { CheckIcon, CloseIcon, InfoIcon } from "@/components/ui/Icons"

export type ToastKind = "success" | "error" | "info"

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  action?: { label: string; onPress: () => void }
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void
  showSuccess: (message: string) => void
  showError: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * Lightweight snackbar used for every success/failure confirmation (docs §19
 * "toast feedback", §36 in-app notifications).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const counter = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setToast(null)
  }, [])

  const showToast = useCallback(
    (message: string, kind: ToastKind = "info", action?: ToastItem["action"]) => {
      counter.current += 1
      setToast({ id: counter.current, kind, message, action })
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setToast(null), action ? 6000 : 3800)
    },
    [],
  )

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      showSuccess: (message: string) => showToast(message, "success"),
      showError: (message: string) => showToast(message, "error"),
    }),
    [showToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastSnackbar toast={toast} onDismiss={hide} /> : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error("useToast must be used inside a ToastProvider")
  return context
}

function ToastSnackbar({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const progress = useState(() => new Animated.Value(0))[0]

  useEffect(() => {
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: Platform.OS !== "web",
      damping: 18,
      stiffness: 180,
    }).start()
  }, [progress, toast.id])

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })
  // Resolved per render so a theme switch repaints the snackbar too.
  const accent =
    toast.kind === "success"
      ? Theme.colors.success
      : toast.kind === "error"
        ? Theme.colors.danger
        : Theme.colors.primary

  return (
    <View style={[styles.host, { pointerEvents: "none" }]}>
      <Animated.View
        style={[
          styles.snackbar,
          {
            borderColor: accent,
            opacity: progress,
            transform: [{ translateY }],
            bottom: Math.max(insets.bottom, 12) + (Platform.OS === "web" ? 24 : 76),
            // `pointerEvents` belongs to the style on react-native-web.
            pointerEvents: "box-none",
          },
        ]}
      >
        <View style={[styles.row, { pointerEvents: "none" }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>
            {toast.kind === "success" ? (
              <CheckIcon color={accent} size={16} />
            ) : toast.kind === "error" ? (
              <CloseIcon color={accent} size={16} />
            ) : (
              <InfoIcon color={accent} size={16} />
            )}
          </View>
          <Text style={styles.message} numberOfLines={3}>
            {toast.message}
          </Text>
          {toast.action ? (
            <Pressable
              onPress={() => {
                toast.action?.onPress()
                onDismiss()
              }}
              style={styles.action}
              accessibilityRole="button"
            >
              <Text style={[styles.actionText, { color: accent }]}>{toast.action.label}</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={onDismiss}
          hitSlop={Theme.hitSlop}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel={t("common.dismiss")}
        >
          <CloseIcon color={Theme.colors.textFaint} size={14} />
        </Pressable>
      </Animated.View>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: "flex-end",
      zIndex: 10_000,
    },
    snackbar: {
      position: "absolute",
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.m,
      paddingHorizontal: Theme.spacing.l,
      borderRadius: Theme.radii.xl,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.modal,
      ...Theme.shadows.lg,
      maxWidth: 560,
      alignSelf: "center",
    },
    row: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
    },
    iconWrap: {
      width: 28,
      height: 28,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    message: {
      flex: 1,
      color: Theme.colors.text,
      fontSize: Theme.sizes.h5,
      fontFamily: Theme.fonts.onest,
      lineHeight: Theme.sizes.h5 * 1.4,
    },
    action: { paddingHorizontal: Theme.spacing.s },
    actionText: {
      fontSize: Theme.sizes.h5,
      fontFamily: Theme.fonts.onestBold,
    },
    close: { padding: 2 },
  })
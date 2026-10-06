import React, { useEffect, useState } from "react"
import { Animated, Modal, Platform, Pressable, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"

interface SheetSurfaceProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  /**
   * `bottom` anchors the panel to the bottom edge (mobile feel), `center` shows
   * it as a dialog, and `auto` picks center on web/desktop and bottom on phones.
   */
  placement?: "auto" | "bottom" | "center"
  maxWidth?: number
}

/**
 * Translucent overlay + animated panel shared by sheets and modal screens.
 * The dimmed backdrop keeps the page behind visible, and the panel springs in
 * exactly like `Dialog` does (docs §19).
 */
export function SheetSurface({
  visible,
  onClose,
  children,
  placement = "auto",
  maxWidth,
}: SheetSurfaceProps) {
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const progress = useState(() => new Animated.Value(0))[0]

  const centered = placement === "center" || (placement === "auto" && Platform.OS === "web")

  useEffect(() => {
    if (!visible) {
      progress.setValue(0)
      return
    }
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: Platform.OS !== "web",
      damping: 20,
      stiffness: 220,
    }).start()
  }, [progress, visible])

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [56, 0] })
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] })

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.host, centered && styles.hostCentered]}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={styles.backdropFill}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            onPress={onClose}
          />
        </Animated.View>
        <Animated.View
          style={[
            centered ? styles.dialog : styles.sheet,
            {
              maxWidth: maxWidth ?? (centered ? 560 : 640),
              opacity: progress,
              transform: centered ? [{ scale }] : [{ translateY }],
            },
            !centered && { paddingBottom: insets.bottom },
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1, justifyContent: "flex-end" },
    hostCentered: { justifyContent: "center", padding: Theme.spacing.xl },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: Theme.colors.backdrop,
    },
    backdropFill: { flex: 1 },
    sheet: {
      width: "100%",
      maxHeight: "92%",
      alignSelf: "center",
      overflow: "hidden",
      backgroundColor: Theme.colors.modal,
      borderTopLeftRadius: Theme.radii.xxl,
      borderTopRightRadius: Theme.radii.xxl,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      ...Theme.shadows.lg,
    },
    dialog: {
      width: "100%",
      maxHeight: "88%",
      alignSelf: "center",
      overflow: "hidden",
      backgroundColor: Theme.colors.modal,
      borderRadius: Theme.radii.xl,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      ...Theme.shadows.lg,
    },
  })

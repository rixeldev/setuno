import React, { useEffect, useMemo, useState } from "react"
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { ToastOverlay } from "@/components/ui/Toast"

interface SheetSurfaceProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  /**
   * `bottom` shows a native-feeling sheet: it slides up from the bottom edge
   * and its handle drags it back down. `center` shows a dialog, and `auto`
   * picks center on web/desktop and bottom on phones.
   */
  placement?: "auto" | "bottom" | "center"
  maxWidth?: number
}

/** Drag further than this (or flick harder) and releasing dismisses the sheet. */
const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 1
const SPRING = { damping: 20, stiffness: 220 } as const

/**
 * Translucent overlay + animated panel shared by sheets and modal screens.
 * Bottom placements slide in from the edge and can be dragged down by the
 * grabber (the backdrop fades with the drag, like a native sheet); centered
 * placements keep the `Dialog`-style scale/fade (docs §19).
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
  const { height: windowHeight } = useWindowDimensions()
  const centered = placement === "center" || (placement === "auto" && Platform.OS === "web")
  // Dialogs nudge a few pixels; sheets travel all the way in from off-screen.
  const closedOffset = centered ? 56 : Math.max(windowHeight, 320)
  const nativeDriver = Platform.OS !== "web"

  // How far the panel is pushed down: 0 = open, `closedOffset` = dismissed.
  const offset = useState(() => new Animated.Value(closedOffset))[0]
  const [mounted, setMounted] = useState(visible)
  // Keep the panel mounted for its exit animation; reopening during it heals
  // right here (the guarded render-phase sync React documents for props).
  if (visible && !mounted) setMounted(true)

  useEffect(() => {
    if (visible) {
      // Park the panel off-screen first (so the first frame never flashes open)
      // and let the spring carry it in.
      offset.setValue(closedOffset)
      Animated.spring(offset, { toValue: 0, useNativeDriver: nativeDriver, ...SPRING }).start()
      return
    }
    Animated.timing(offset, {
      toValue: closedOffset,
      duration: 200,
      useNativeDriver: nativeDriver,
    }).start(({ finished }) => {
      if (finished) setMounted(false)
    })
  }, [visible, closedOffset, offset, nativeDriver])

  // The grabber follows the finger: dismiss past the threshold or with a quick
  // flick, otherwise spring back to open. The drag bookkeeping lives in the
  // responder's own closure — it never needs to render.
  const panResponder = useMemo(() => {
    let dragStart = 0
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        offset.stopAnimation((value) => {
          dragStart = value
        })
      },
      onPanResponderMove: (_event, gesture) => {
        offset.setValue(Math.max(0, dragStart + gesture.dy))
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
          Animated.timing(offset, {
            toValue: closedOffset,
            duration: 220,
            useNativeDriver: nativeDriver,
          }).start(({ finished }) => {
            if (finished) onClose()
          })
          return
        }
        Animated.spring(offset, { toValue: 0, useNativeDriver: nativeDriver, ...SPRING }).start()
      },
      onPanResponderTerminate: () => {
        Animated.spring(offset, { toValue: 0, useNativeDriver: nativeDriver, ...SPRING }).start()
      },
    })
  }, [offset, closedOffset, nativeDriver, onClose])

  const backdropOpacity = offset.interpolate({
    inputRange: [0, closedOffset],
    outputRange: [1, 0],
    extrapolate: "clamp",
  })
  const scale = offset.interpolate({
    inputRange: [0, closedOffset],
    outputRange: [1, 0.94],
    extrapolate: "clamp",
  })

  return (
    <Modal
      visible={mounted}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.host, centered && styles.hostCentered]}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
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
              opacity: centered ? backdropOpacity : 1,
              transform: centered ? [{ scale }] : [{ translateY: offset }],
            },
            !centered && { paddingBottom: insets.bottom },
          ]}
        >
          {!centered ? (
            <View style={styles.handle} {...panResponder.panHandlers}>
              <View style={styles.grabber} />
            </View>
          ) : null}
          {children}
        </Animated.View>
        <ToastOverlay />
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
    handle: {
      alignItems: "center",
      paddingTop: Theme.spacing.s,
      paddingBottom: Theme.spacing.xs,
    },
    grabber: {
      width: 44,
      height: 5,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.border,
    },
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
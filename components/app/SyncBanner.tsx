import React, { useEffect, useState } from "react"
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { CheckCircleIcon, OfflineIcon } from "@/components/ui/Icons"
import { useSyncState } from "@/services/sync"

type BannerView = "hidden" | "offline" | "syncing" | "synced"

/**
 * Connectivity + sync state (docs §37).
 *
 * Offline it explains that changes are saved on the device; when the connection
 * returns it shows the queue draining and confirms for a moment once everything
 * reached the server, then gets out of the way. The timing lives in
 * `services/sync.ts`, so this component is a pure render of the sync state.
 *
 * **The banner slides instead of jumping.** It used to be mounted and
 * unmounted, so the content below it moved a whole row in one frame — the
 * "everything is up to date" note popped in and out like a blink. The banner
 * stays mounted and its height is animated, so the content moves with it.
 */
export function SyncBanner() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { status, justSynced } = useSyncState()
  // One animated value for the whole life of the banner: 0 is hidden, 1 is
  // fully shown. Created once (never a module-level value).
  const [progress] = useState(() => new Animated.Value(0))
  const [contentHeight, setContentHeight] = useState(0)

  const view: BannerView =
    status === "offline" ? "offline" : status === "syncing" ? "syncing" : justSynced ? "synced" : "hidden"
  const visible = view !== "hidden"

  useEffect(() => {
    if (!visible) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }).start()
      return
    }
    // Wait for the measurement: animating to a height of zero would look like
    // the banner never arrived.
    if (contentHeight === 0) return
    Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      useNativeDriver: false,
    }).start()
  }, [contentHeight, progress, visible])

  return (
    <Animated.View
      style={[
        styles.host,
        {
          height: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, contentHeight],
          }),
        },
      ]}
    >
      {/*
        The banner's own content is **out of the flow**: it is measured inside a
        box that is being resized, and a child of a resized box can be laid out
        against the smaller height (which is what cut the banner in half). As an
        absolutely positioned layer it keeps its natural height, so the
        measurement is always the real one and the host can grow to fit it.
      */}
      <View
        style={[
          styles.banner,
          styles.layer,
          view === "offline" && styles.bannerOffline,
          view === "synced" && styles.bannerSynced,
        ]}
        onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
        accessibilityRole="alert"
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? "yes" : "no-hide-descendants"}
      >
        <View style={styles.iconBox}>
          {view === "offline" ? (
            <OfflineIcon size={14} color={Theme.colors.warning} />
          ) : view === "syncing" ? (
            <ActivityIndicator size="small" color={Theme.colors.primary} />
          ) : (
            <CheckCircleIcon size={14} color={Theme.colors.success} />
          )}
        </View>
        <AppText
          variant="caption"
          tone={view === "offline" ? "accent" : view === "synced" ? "success" : "primary"}
        >
          {view === "offline"
            ? t("sync.offline")
            : view === "syncing"
              ? t("sync.syncing")
              : t("sync.synced")}
        </AppText>
      </View>
    </Animated.View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    // The animated host: it clips the banner while it is closed, so the row
    // never takes space it is not using.
    host: { overflow: "hidden" },
    // The banner's own layer: out of the flow, so the host can resize it
    // without ever laying it out against a smaller height.
    layer: { position: "absolute", top: 0, left: 0, right: 0 },
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      paddingHorizontal: Theme.spacing.l,
      paddingVertical: Theme.spacing.s,
      backgroundColor: Theme.colors.background2,
    },
    // One box for every state, so the row keeps the same height while the
    // note changes (the spinner is taller than the icons).
    iconBox: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
    bannerOffline: { backgroundColor: Theme.colors.warningSoft },
    bannerSynced: { backgroundColor: Theme.colors.successSoft },
  })

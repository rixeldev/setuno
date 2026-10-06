import React from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
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
 */
export function SyncBanner() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { status, justSynced } = useSyncState()

  const view: BannerView =
    status === "offline" ? "offline" : status === "syncing" ? "syncing" : justSynced ? "synced" : "hidden"

  if (view === "hidden") return null

  return (
    <View
      style={[
        styles.banner,
        view === "offline" && styles.bannerOffline,
        view === "synced" && styles.bannerSynced,
      ]}
      accessibilityRole="alert"
    >
      {view === "offline" ? (
        <OfflineIcon size={14} color={Theme.colors.warning} />
      ) : view === "syncing" ? (
        <ActivityIndicator size="small" color={Theme.colors.primary} />
      ) : (
        <CheckCircleIcon size={14} color={Theme.colors.success} />
      )}
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
  )
}

const createStyles = () =>
  StyleSheet.create({
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      paddingHorizontal: Theme.spacing.l,
      paddingVertical: Theme.spacing.s,
      backgroundColor: Theme.colors.background2,
    },
    bannerOffline: { backgroundColor: Theme.colors.warningSoft },
    bannerSynced: { backgroundColor: Theme.colors.successSoft },
  })

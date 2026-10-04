import React from "react"
import { Platform, StyleSheet, View } from "react-native"
import { useNetInfo } from "@react-native-community/netinfo"
import { SafeAreaView } from "react-native-safe-area-context"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { OfflineIcon } from "@/components/ui/Icons"
import { BottomBar, SidebarNav } from "@/components/app/AppNavigation"
import { useResponsive } from "@/hooks/useResponsive"

/**
 * Responsive chrome: sidebar navigation on Web/desktop, bottom tabs on mobile,
 * with a safe-area aware content area (docs §18, §21).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles)
  const { usesSidebar } = useResponsive()

  if (usesSidebar) {
    return (
      <View style={styles.desktop}>
        <SidebarNav />
        <View style={styles.desktopContent}>
          <OfflineBanner />
          {children}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.mobile}>
      <SafeAreaView style={styles.mobileContent} edges={["top", "left", "right"]}>
        <OfflineBanner />
        {children}
      </SafeAreaView>
      <BottomBar />
    </View>
  )
}

/** Discreet offline notice (docs §37). */
export function OfflineBanner() {
  const styles = useThemedStyles(createStyles)
  const netInfo = useNetInfo()
  // `isInternetReachable` is null while probing, which we treat as "online".
  if (netInfo.isInternetReachable !== false) return null

  return (
    <View style={styles.offline} accessibilityRole="alert">
      <OfflineIcon size={14} color={Theme.colors.warning} />
      <AppText variant="caption" tone="accent">
        You are offline. Changes are sent as soon as the connection is back.
      </AppText>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    desktop: {
      flex: 1,
      flexDirection: "row",
      ...Platform.select({ web: { minHeight: "100vh" as never }, default: {} }),
    },
    desktopContent: { flex: 1, minWidth: 0 },
    mobile: { flex: 1 },
    mobileContent: { flex: 1 },
    offline: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      paddingHorizontal: Theme.spacing.l,
      paddingVertical: Theme.spacing.s,
      backgroundColor: Theme.colors.warningSoft,
    },
  })

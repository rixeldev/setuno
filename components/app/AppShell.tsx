import React, { useEffect } from "react"
import { Platform, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { usePathname } from "expo-router"

import { useThemedStyles } from "@/hooks/useThemedStyles"
import { setBottomChromeHeight } from "@/hooks/useBottomChrome"
import { BottomBar, SidebarNav } from "@/components/app/AppNavigation"
import { SyncBanner } from "@/components/app/SyncBanner"
import { BannerAdSlot } from "@/components/ads/BannerAdSlot"
import { useResponsive } from "@/hooks/useResponsive"
import { isFocusRoute } from "@/libs/navigation"

/**
 * Responsive chrome: sidebar navigation on Web/desktop, bottom tabs on mobile,
 * with a safe-area aware content area (docs §18, §21).
 *
 * Editing flows (`isFocusRoute`) hide the navigation entirely: while typing a
 * song there is nowhere to tap that could lose the work in progress.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles)
  const { usesSidebar } = useResponsive()
  const pathname = usePathname()
  const focused = isFocusRoute(pathname)
  // On desktop the banner stays a dashboard detail (web renders nothing); the
  // mobile slot below is persistent while the navigation is visible.
  const onDashboard = pathname === "/" && !focused

  // Floating UI (the toast) anchors above the measured bottom chrome; release
  // it while the bar is hidden and when the shell goes away.
  useEffect(() => {
    if (focused) setBottomChromeHeight(0)
  }, [focused])
  useEffect(() => () => setBottomChromeHeight(0), [])

  if (usesSidebar) {
    return (
      <View style={styles.desktop}>
        {focused ? null : <SidebarNav />}
        <View style={styles.desktopContent}>
          <SyncBanner />
          {children}
          {onDashboard ? <BannerAdSlot /> : null}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.mobile}>
      <SafeAreaView style={styles.mobileContent} edges={["top", "left", "right"]}>
        <SyncBanner />
        {children}
      </SafeAreaView>
      {focused ? null : (
        <View
          onLayout={(event) => setBottomChromeHeight(event.nativeEvent.layout.height)}
        >
          <BottomBar />
          {/* The banner stays mounted under the tab bar across tabs, so it
              never appears and disappears while navigating. */}
          <BannerAdSlot fullWidth />
        </View>
      )}
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
  })

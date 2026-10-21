import React, { useEffect } from "react"
import { Platform, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { usePathname } from "expo-router"

import { useThemedStyles } from "@/hooks/useThemedStyles"
import { setBottomChromeHeight } from "@/hooks/useBottomChrome"
import { BottomBar, SidebarNav } from "@/components/app/AppNavigation"
import { CommandPaletteHost } from "@/components/app/CommandPaletteHost"
import { SyncBanner } from "@/components/app/SyncBanner"
import { BannerAdSlot } from "@/components/ads/BannerAdSlot"
import { useResponsive } from "@/hooks/useResponsive"
import { usePushRegistration } from "@/hooks/usePushRegistration"
import { usePushPrompt } from "@/hooks/usePushPrompt"
import { PushPromptDialog } from "@/components/app/PushPromptDialog"
import { useHomeWidget } from "@/hooks/useHomeWidget"
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

  // Push registrations refresh silently here (roadmap #52): never prompts,
  // never resurrects a device the user switched off in the settings screen.
  usePushRegistration()

  // The app-start question about notifications: it is asked once, while the OS
  // would still ask, and never on a flow that takes over the screen.
  const pushPrompt = usePushPrompt()
  const pushDialog = focused ? null : (
    <PushPromptDialog
      visible={pushPrompt.visible}
      onAccept={pushPrompt.accept}
      onDecline={pushPrompt.decline}
    />
  )

  // The Android home-screen widget follows the band's next gig (roadmap #78).
  // The push happens here, where the band data is already subscribed.
  useHomeWidget()

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
        <CommandPaletteHost />
        {pushDialog}
      </View>
    )
  }

  return (
    <View style={styles.mobile}>
      <SafeAreaView style={styles.mobileContent} edges={["top", "left", "right"]}>
        <SyncBanner />
        {children}
      </SafeAreaView>
      <CommandPaletteHost />
      {pushDialog}
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

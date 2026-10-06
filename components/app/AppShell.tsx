import React from "react"
import { Platform, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { usePathname } from "expo-router"

import { useThemedStyles } from "@/hooks/useThemedStyles"
import { BottomBar, SidebarNav } from "@/components/app/AppNavigation"
import { SyncBanner } from "@/components/app/SyncBanner"
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

  if (usesSidebar) {
    return (
      <View style={styles.desktop}>
        {focused ? null : <SidebarNav />}
        <View style={styles.desktopContent}>
          <SyncBanner />
          {children}
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
      {focused ? null : <BottomBar />}
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

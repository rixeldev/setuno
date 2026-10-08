import React, { useEffect, useState } from "react"
import { View } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useFonts } from "expo-font"
import { Onest_400Regular } from "@expo-google-fonts/onest/400Regular"
import { Onest_700Bold } from "@expo-google-fonts/onest/700Bold"
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono/400Regular"

import { Theme } from "@/constants/Theme"
import { AuthProvider } from "@/hooks/useAuth"
import { OrganizationProvider } from "@/hooks/useOrganization"
import { OrgDataProvider } from "@/hooks/useOrgData"
import { ToastProvider } from "@/components/ui/Toast"
import { AppUpdateGate } from "@/components/app/AppUpdateGate"
import { StartupGate } from "@/components/app/StartupGate"
import { SPLASH_BACKGROUND } from "@/components/app/StartupSplash"
import { hydrateAppearance } from "@/services/themeManager"
import { hydrateLanguage } from "@/services/i18next"
import { hydratePreferences } from "@/services/prefs"
import { hydrateRecentChords } from "@/services/recentChords"
import { initializeAds } from "@/services/ads"
import { startSyncWatcher } from "@/services/sync"
import { installWebDocumentStyles } from "@/libs/webStyles"

// The native splash covers the first frames; the animated one (StartupSplash)
// takes over as soon as it is painted (docs §19).
SplashScreen.preventAutoHideAsync().catch(() => undefined)
try {
  SplashScreen.setOptions({ duration: 280, fade: true })
} catch {
  // setOptions does not exist on web.
}

/**
 * Root layout: fonts, appearance, data providers and the route tree.
 * Auth and organization state live here so every screen can rely on them.
 */
export default function Layout() {
  const [preferencesReady, setPreferencesReady] = useState(false)
  const [fontsLoaded, fontError] = useFonts({
    Onest: Onest_400Regular,
    OnestBold: Onest_700Bold,
    // Bundled mono for the chord/lyric grids: identical metrics on every
    // platform (Android's system `monospace` is not truly monospaced).
    Mono: JetBrainsMono_400Regular,
  })

  // Every stored preference (theme, language, reader settings) is restored
  // before the first frame so nothing flashes with the wrong values (docs §32).
  useEffect(() => {
    let mounted = true
    Promise.all([
      hydrateAppearance(),
      hydrateLanguage(),
      hydratePreferences(),
      hydrateRecentChords(),
    ])
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setPreferencesReady(true)
      })
    return () => {
      mounted = false
    }
  }, [])

  // Offline writes live in the Firestore cache; this keeps the UI informed and
  // drains the queue as soon as the connection is back (docs §37).
  useEffect(() => startSyncWatcher(), [])

  // Google Mobile Ads warm-up (no-op on web, see `services/ads.web.ts`).
  useEffect(() => {
    initializeAds()
  }, [])

  // Clears the browser's default focus ring around text fields (web only).
  useEffect(() => {
    installWebDocumentStyles()
  }, [])

  const ready = (fontsLoaded || fontError !== null) && preferencesReady

  if (!ready) {
    // Still under the native splash: paint its colour so nothing flashes.
    return <View style={{ flex: 1, backgroundColor: SPLASH_BACKGROUND }} />
  }

  return (
    <SafeAreaProvider>
      <StatusBar />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ToastProvider>
          <AuthProvider>
            <OrganizationProvider>
              <OrgDataProvider>
                <StartupGate>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      animation: "slide_from_right",
                      animationDuration: 180,
                      contentStyle: { backgroundColor: Theme.colors.background },
                    }}
                  >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(app)" />
                  </Stack>
                </StartupGate>
                <AppUpdateGate />
              </OrgDataProvider>
            </OrganizationProvider>
          </AuthProvider>
        </ToastProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  )
}

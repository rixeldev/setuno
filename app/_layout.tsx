import React, { useEffect, useState } from "react"
import { View } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useFonts } from "expo-font"
import { Onest_400Regular, Onest_700Bold } from "@expo-google-fonts/onest"

import { Theme } from "@/constants/Theme"
import { AuthProvider } from "@/hooks/useAuth"
import { OrganizationProvider } from "@/hooks/useOrganization"
import { OrgDataProvider } from "@/hooks/useOrgData"
import { ToastProvider } from "@/components/ui/Toast"
import { hydrateAppearance } from "@/services/themeManager"
import { installWebDocumentStyles } from "@/libs/webStyles"
import "@/services/i18next"

SplashScreen.preventAutoHideAsync().catch(() => undefined)

/**
 * Root layout: fonts, appearance, data providers and the route tree.
 * Auth and organization state live here so every screen can rely on them.
 */
export default function Layout() {
  const [appearanceReady, setAppearanceReady] = useState(false)
  const [fontsLoaded, fontError] = useFonts({
    Onest: Onest_400Regular,
    OnestBold: Onest_700Bold,
  })

  useEffect(() => {
    let mounted = true
    hydrateAppearance()
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setAppearanceReady(true)
      })
    return () => {
      mounted = false
    }
  }, [])

  // Clears the browser's default focus ring around text fields (web only).
  useEffect(() => {
    installWebDocumentStyles()
  }, [])

  const ready = (fontsLoaded || fontError !== null) && appearanceReady

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined)
  }, [ready])

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: Theme.colors.background }} />
  }

  return (
    <SafeAreaProvider>
      <StatusBar />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <ToastProvider>
            <AuthProvider>
              <OrganizationProvider>
                <OrgDataProvider>
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
                </OrgDataProvider>
              </OrganizationProvider>
            </AuthProvider>
          </ToastProvider>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  )
}

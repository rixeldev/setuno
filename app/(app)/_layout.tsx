import React from "react"
import { Redirect, Stack } from "expo-router"

import { AppShell } from "@/components/app/AppShell"
import { useAuth } from "@/hooks/useAuth"
import { Theme } from "@/constants/Theme"

/**
 * Authenticated area. Every screen shares the responsive shell (sidebar on
 * Web/desktop, bottom navigation on mobile). Users without a band stay inside
 * the app and create one whenever they want (docs §7).
 */
export default function AppLayout() {
  const { status } = useAuth()

  if (status === "signed-out") return <Redirect href="/(auth)/sign-in" />

  return (
    <AppShell>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          animationDuration: 180,
          contentStyle: { backgroundColor: Theme.colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="songs/index" />
        <Stack.Screen name="songs/new" />
        <Stack.Screen name="songs/[id]/index" />
        <Stack.Screen name="songs/[id]/edit" />
        <Stack.Screen name="songs/[id]/suggest" />
        <Stack.Screen name="setlists/index" />
        <Stack.Screen name="setlists/new" />
        <Stack.Screen name="setlists/[id]/index" />
        <Stack.Screen name="setlists/[id]/edit" />
        <Stack.Screen name="performances/index" />
        <Stack.Screen name="performances/new" />
        <Stack.Screen name="performances/[id]/index" />
        <Stack.Screen name="performances/[id]/edit" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="members" />
        <Stack.Screen name="suggestions/index" />
        <Stack.Screen name="suggestions/new" />
        <Stack.Screen name="suggestions/[id]" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/profile" />
        <Stack.Screen name="settings/organization" />
        <Stack.Screen name="settings/appearance" />
        <Stack.Screen name="more" />
        <Stack.Screen name="organizations/index" />
        <Stack.Screen name="organizations/new" />
      </Stack>
    </AppShell>
  )
}
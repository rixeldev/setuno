import React from "react"
import { Redirect, Stack } from "expo-router"

import { useAuth } from "@/hooks/useAuth"

/**
 * Authentication screens (no shell chrome). Signed-in users are sent straight
 * back into the app: this heals the brief race where a sign-in lands a moment
 * before the root gate has seen the new session.
 */
export default function AuthLayout() {
  const { status } = useAuth()

  if (status === "signed-in") return <Redirect href="/" />

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: "transparent" },
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="welcome" />
    </Stack>
  )
}

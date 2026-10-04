import React from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { Redirect } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"

/**
 * Session gate: decides where a user lands based on authentication and band
 * membership (signed out → auth, otherwise the app). Bandless users start on
 * the dashboard and create a band from inside the app (docs §7).
 */
export default function Index() {
  const styles = useGateStyles()
  const { status } = useAuth()
  const { state } = useOrganization()

  if (status === "initializing" || (status === "signed-in" && state === "loading")) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Theme.colors.primary} />
      </View>
    )
  }

  if (status === "signed-out") {
    return <Redirect href="/(auth)/sign-in" />
  }

  return <Redirect href="/(app)" />
}

function useGateStyles() {
  return StyleSheet.create({
    loading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.background,
    },
  })
}

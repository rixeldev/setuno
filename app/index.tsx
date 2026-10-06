import React from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { Redirect } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useAuth } from "@/hooks/useAuth"

/**
 * Session gate: decides where a user lands based on authentication (docs §7).
 *
 * It deliberately does not wait for the band list: signed-in users go straight
 * into the app, which renders its own loading states, so a slow or offline
 * band query can never trap them on a spinner — nor flash the wrong screen.
 */
export default function Index() {
  const styles = useGateStyles()
  const { status } = useAuth()

  if (status === "initializing") {
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

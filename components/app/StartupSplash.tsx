import React, { useEffect, useState } from "react"
import { Animated, Easing, Platform, StyleSheet, View } from "react-native"
import * as SplashScreen from "expo-splash-screen"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"

/** Shares the native splash colour so the swap between the two is invisible. */
export const SPLASH_BACKGROUND = "#0B0B14"
const CREAM = "#FFF7EE"
const NATIVE_DRIVER = Platform.OS !== "web"

/**
 * Boot screen (docs §19): the brand mark breathing gently with a three-dot
 * loader on the splash colour. `StartupGate` keeps it on screen until the app
 * has finished loading; `onLayout` dismisses the static native splash once this
 * one is already painted, so nothing flashes in between.
 */
export function StartupSplash() {
  const { t } = useTranslation()
  const [pulse] = useState(() => new Animated.Value(0))
  const [loaderOpacity] = useState(() => new Animated.Value(0))
  const [dots] = useState(() => [
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ])

  useEffect(() => {
    const half = 900
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: half,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
    )

    // Each dot dips and recovers slightly after the previous one.
    const dotLoops = dots.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 180),
          Animated.timing(value, {
            toValue: 0.25,
            duration: 280,
            easing: Easing.out(Easing.quad),
            useNativeDriver: NATIVE_DRIVER,
          }),
          Animated.timing(value, {
            toValue: 1,
            duration: 280,
            easing: Easing.in(Easing.quad),
            useNativeDriver: NATIVE_DRIVER,
          }),
          Animated.delay((dots.length - 1 - index) * 180),
        ]),
      ),
    )

    // The loader appears once the mark settles, so the swap from the native
    // splash (which has no loader) stays subtle.
    const fadeIn = Animated.timing(loaderOpacity, {
      toValue: 1,
      duration: 450,
      delay: 300,
      useNativeDriver: NATIVE_DRIVER,
    })

    pulseLoop.start()
    dotLoops.forEach((loop) => loop.start())
    fadeIn.start()

    return () => {
      pulseLoop.stop()
      dotLoops.forEach((loop) => loop.stop())
      fadeIn.stop()
    }
  }, [dots, loaderOpacity, pulse])

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] })

  return (
    <View
      style={styles.host}
      accessibilityRole="progressbar"
      accessibilityLabel={t("common.loading")}
      onLayout={() => {
        // This screen is painted: the static native splash can go.
        void SplashScreen.hideAsync().catch(() => undefined)
      }}
    >
      <Animated.Image
        source={require("../../assets/splash-icon.png")}
        resizeMode="contain"
        style={[styles.mark, { transform: [{ scale }] }]}
      />
      <Animated.View style={[styles.loader, { opacity: loaderOpacity }]}>
        {dots.map((value, index) => (
          <Animated.View key={index} style={[styles.dot, { opacity: value }]} />
        ))}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Theme.spacing.l,
    backgroundColor: SPLASH_BACKGROUND,
  },
  mark: { width: 200, height: 200 },
  loader: { flexDirection: "row", gap: Theme.spacing.s },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: CREAM },
})

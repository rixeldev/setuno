import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { BANNER_SIZE, BANNER_UNIT_ID } from "@/services/ads"

/**
 * Google banner slot. It stays collapsed at zero height until an ad is actually
 * loaded, so screens never keep an empty gap when there is no fill (offline, no
 * inventory, ad blocker…). Web renders nothing (see `BannerAdSlot.web.tsx`).
 *
 * `fullWidth` uses the anchored adaptive unit, which fills the screen width and
 * is meant for bottom-of-screen placements (the dashboard slot).
 */
export function BannerAdSlot({ fullWidth = false }: { fullWidth?: boolean }) {
  const styles = useThemedStyles(createStyles)
  const [loaded, setLoaded] = useState(false)

  return (
    <View style={loaded ? styles.host : styles.collapsed}>
      <BannerAd
        unitId={BANNER_UNIT_ID}
        size={fullWidth ? BannerAdSize.ANCHORED_ADAPTIVE_BANNER : BANNER_SIZE}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: { alignItems: "center", paddingVertical: Theme.spacing.s },
    collapsed: { height: 0, overflow: "hidden" },
  })

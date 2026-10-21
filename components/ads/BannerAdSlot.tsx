import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useEntitlement } from "@/hooks/useEntitlement"
import { BANNER_SIZE, BANNER_UNIT_ID } from "@/services/ads"

/**
 * Google banner slot. It stays collapsed at zero height until an ad is actually
 * loaded, so screens never keep an empty gap when there is no fill (offline, no
 * inventory, ad blocker…). Web renders nothing (see `BannerAdSlot.web.tsx`).
 *
 * `fullWidth` uses the anchored adaptive unit, which fills the screen width and
 * is meant for bottom-of-screen placements (the dashboard slot).
 *
 * **Pro members see no ads at all** (roadmap #61): the slot is not even
 * mounted, so nothing is requested and nothing is shown.
 *
 * A build with no valid unit id renders nothing either: `BannerAd` throws when
 * it mounts with an empty id, and that throw is fatal. The check lives in
 * `services/ads.ts`, next to the id itself.
 */
export function BannerAdSlot({ fullWidth = false }: { fullWidth?: boolean }) {
  const styles = useThemedStyles(createStyles)
  const [loaded, setLoaded] = useState(false)
  const plan = useEntitlement()

  if (plan.isPro || BANNER_UNIT_ID === null) return null

  return (
    <View
      style={[
        loaded ? styles.host : styles.collapsed,
        // The anchored adaptive banner is meant to sit **against the bottom
        // edge**: it is the last thing on the screen, and the padding that
        // suits the dashboard slot would leave a strip of empty background
        // under it.
        fullWidth && styles.hostFlush,
      ]}
    >
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
    // No padding: the banner touches the bottom of the screen.
    hostFlush: { paddingVertical: 0 },
    collapsed: { height: 0, overflow: "hidden" },
  })

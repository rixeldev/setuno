import { BannerAdSize, MobileAds, TestIds } from "react-native-google-mobile-ads"

import { adBannerId } from "@/db/firebaseConfig"

/**
 * Google Mobile Ads setup.
 *
 * Release builds serve the AdMob unit configured in `db/firebaseConfig.ts`;
 * development keeps the SDK's official test unit (or `EXPO_PUBLIC_ADMOB_BANNER_ID`
 * when set) so testing never generates invalid traffic.
 */
export const BANNER_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ?? (__DEV__ ? TestIds.BANNER : adBannerId)
export const BANNER_SIZE = BannerAdSize.BANNER

/** Initialises the SDK once per app start; safe to call more than once. */
export const initializeAds = (): void => {
  void MobileAds()
    .initialize()
    .catch(() => undefined)
}

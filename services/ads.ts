import { BannerAdSize, MobileAds, TestIds } from "react-native-google-mobile-ads"

/**
 * Google Mobile Ads setup.
 *
 * The banner slot uses the SDK's official test unit until a real one is
 * configured through `EXPO_PUBLIC_ADMOB_BANNER_ID`, so development and
 * preview builds never generate invalid traffic.
 */
export const BANNER_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ?? TestIds.BANNER
export const BANNER_SIZE = BannerAdSize.BANNER

/** Initialises the SDK once per app start; safe to call more than once. */
export const initializeAds = (): void => {
  void MobileAds()
    .initialize()
    .catch(() => undefined)
}

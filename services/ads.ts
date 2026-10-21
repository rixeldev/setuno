import { BannerAdSize, MobileAds, TestIds } from "react-native-google-mobile-ads"

import { adBannerId } from "@/db/firebaseConfig"
import { resolveBannerUnitId } from "@/libs/ads"

/**
 * Google Mobile Ads setup.
 *
 * Release builds serve the AdMob unit configured in `db/firebaseConfig.ts`;
 * development keeps the SDK's official test unit (or `EXPO_PUBLIC_ADMOB_BANNER_ID`
 * when set) so testing never generates invalid traffic.
 *
 * The id is validated before it ever reaches the SDK: `adBannerId` is empty
 * until `ADMOB_BANNER_ID` is set (see `scripts/ensure-firebase-config.mjs`), and
 * mounting a banner with no unit throws inside the native module's effect —
 * which crashes the app the moment the shell renders, sign-in included. `null`
 * means "this build has no ad unit": the slot renders nothing.
 */
const configuredUnitId = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID

export const BANNER_UNIT_ID: string | null =
  resolveBannerUnitId(configuredUnitId) ??
  resolveBannerUnitId(__DEV__ ? TestIds.BANNER : adBannerId)

export const BANNER_SIZE = BannerAdSize.BANNER

/** Initialises the SDK once per app start; safe to call more than once. */
export const initializeAds = (): void => {
  void MobileAds()
    .initialize()
    .catch(() => undefined)
}

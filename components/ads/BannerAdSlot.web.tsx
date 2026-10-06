/**
 * Web shim: the ad SDK is native-only, so the slot renders nothing and takes no
 * space on web. Metro resolves this file for platform=web.
 */
export function BannerAdSlot() {
  return null
}

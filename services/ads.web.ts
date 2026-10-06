/**
 * Web shim: Google Mobile Ads is native-only, so every call here is a no-op and
 * the banner slot renders nothing. Metro resolves this file for platform=web.
 */
export const BANNER_UNIT_ID = ""
export const BANNER_SIZE = "BANNER"
export const initializeAds = (): void => undefined

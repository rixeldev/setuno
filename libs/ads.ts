/** Google Mobile Ads helpers shared by the native slot and the unit tests. */

/**
 * The shape of a Google Mobile Ads unit id: `ca-app-pub-` + 16 publisher
 * digits + `/` + 10 unit digits.
 *
 * The SDK does not validate it — it throws when the banner mounts, and a throw
 * from the native module's effect takes the whole app down. So every id is
 * checked here first and a build with no (or a half-configured) unit simply
 * shows no ad.
 */
const BANNER_UNIT_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{10}$/

/**
 * Returns the unit id when it is a real one, or `null` when it is not.
 *
 * Surrounding whitespace is trimmed (an env var pasted with a trailing space is
 * a common accident), but a placeholder such as the empty string the config
 * generator leaves behind when `ADMOB_BANNER_ID` was never set — or the
 * `ca-app-pub-xxx` some docs copy — is rejected instead of handed to the SDK.
 */
export const resolveBannerUnitId = (
  candidate: string | null | undefined,
): string | null => {
  const value = candidate?.trim() ?? ""
  return BANNER_UNIT_ID_PATTERN.test(value) ? value : null
}

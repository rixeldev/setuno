/**
 * Username rules (docs §32): names are unique regardless of case (`Rixel` ===
 * `rixel`) and can only be changed once every three months.
 */
export const USERNAME_CHANGE_WINDOW_DAYS = 90
export const USERNAME_CHANGE_WINDOW_MS = USERNAME_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000

/**
 * Visible form stored on the profile: trimmed, inner whitespace collapsed and
 * slashes replaced (they are not valid inside a Firestore document id, and the
 * username claim is keyed by this name).
 */
export const normalizeUsername = (value: string): string =>
  value.trim().replace(/\s+/g, " ").replace(/\//g, "-")

/** Comparison/claim key: case-insensitive, so `Rixel` and `rixel` are the same. */
export const usernameKey = (value: string): string => normalizeUsername(value).toLocaleLowerCase()

/**
 * `Rixel` -> `Rixel-1415` (always four digits). `random` is injectable so the
 * format can be unit tested.
 */
export const usernameWithSuffix = (base: string, random: () => number = Math.random): string => {
  const suffix = 1000 + Math.floor(random() * 9000)
  return `${normalizeUsername(base)}-${suffix}`
}

/** True when the cooldown passed (or the username was never changed). */
export const canChangeUsername = (lastChangedMs: number | null, nowMs: number): boolean =>
  lastChangedMs === null || nowMs - lastChangedMs >= USERNAME_CHANGE_WINDOW_MS

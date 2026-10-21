/**
 * Username rules (docs §32): names are unique regardless of case (`Rixel` ===
 * `rixel`) and can only be changed once every three months.
 */
export const USERNAME_CHANGE_WINDOW_DAYS = 90
export const USERNAME_CHANGE_WINDOW_MS = USERNAME_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000

/**
 * The name a brand new account gets when the real one has not arrived yet.
 *
 * The account's name can come a moment after the account itself (the email
 * sign-up sets it right after creating it), and the profile must exist
 * straight away. This is the name that keeps the space until the real one
 * shows up — and it is the one the profile is healed from, so it is a
 * **contract**: the rules know it by name.
 */
export const PLACEHOLDER_USERNAME = "Musician"

/** True when a name is the placeholder, or nothing at all. */
export const isPlaceholderUsername = (value: string | null | undefined): boolean => {
  const trimmed = (value ?? "").trim()
  if (trimmed.length === 0) return true
  if (trimmed === PLACEHOLDER_USERNAME) return true
  // The placeholder with the suffix the registry adds when it is taken.
  return new RegExp(`^${PLACEHOLDER_USERNAME}-\\d{4}$`).test(trimmed)
}

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

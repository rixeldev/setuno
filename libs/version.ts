/** Dotted-version helpers for the forced-update check. */

/**
 * Compares two dotted version strings (`1.2.3`).
 *
 * Missing segments count as zero (`1.1` equals `1.1.0`) and non-numeric
 * segments count as zero too, so a malformed value can never look newer than
 * a real release on its own.
 *
 * @returns -1 when `left` is older, 1 when newer, 0 when equal.
 */
export const compareVersions = (left: string, right: string): number => {
  const leftParts = left.split(".")
  const rightParts = right.split(".")
  const segments = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < segments; index += 1) {
    const a = Number.parseInt(leftParts[index] ?? "0", 10) || 0
    const b = Number.parseInt(rightParts[index] ?? "0", 10) || 0
    if (a !== b) return a > b ? 1 : -1
  }
  return 0
}

/** Highest version in the list, or `null` when none carries a value. */
export const maxVersion = (versions: string[]): string | null => {
  let latest: string | null = null
  for (const version of versions) {
    const value = version.trim()
    if (!value) continue
    if (latest === null || compareVersions(value, latest) > 0) latest = value
  }
  return latest
}

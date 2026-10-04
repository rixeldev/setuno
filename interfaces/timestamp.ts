/**
 * Firestore timestamp shape kept platform agnostic so domain models never
 * depend on a specific Firebase SDK type.
 */
export interface TimestampLike {
  seconds: number
  nanoseconds: number
  toDate: () => Date
}

export type MaybeTimestamp = TimestampLike | null | undefined

/** Converts a Firestore timestamp (or ISO string) into a `Date`. */
export const toDate = (value: MaybeTimestamp | string | null | undefined): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "string") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  if (typeof value.toDate === "function") return value.toDate()
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000)
  return null
}

/** Falls back to `null` when a timestamp is missing or invalid. */
export const toMillis = (value: MaybeTimestamp | string | null | undefined): number | null => {
  const date = toDate(value)
  return date ? date.getTime() : null
}
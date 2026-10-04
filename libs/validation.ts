import { ValidationError } from "@/services/errors"

/** Field-level validators shared by the login, register and reset forms. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
export const MIN_PASSWORD_LENGTH = 6
export const MAX_PASSWORD_LENGTH = 128

export const isValidEmail = (value: string): boolean => EMAIL_PATTERN.test(value.trim())

export const validateEmail = (value: string, label = "Email"): string | null => {
  const email = value.trim()
  if (email.length === 0) return `${label} is required.`
  if (!isValidEmail(email)) return `Enter a valid email address.`
  return null
}

export const validatePassword = (value: string, label = "Password"): string | null => {
  if (value.length === 0) return `${label} is required.`
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `${label} must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return `${label} must be shorter than ${MAX_PASSWORD_LENGTH} characters.`
  }
  return null
}

export const validateRequired = (
  value: string,
  label: string,
  options: { max?: number } = {},
): string | null => {
  const trimmed = value.trim()
  if (trimmed.length === 0) return `${label} is required.`
  if (options.max && trimmed.length > options.max) {
    return `${label} must be ${options.max} characters or fewer.`
  }
  return null
}

export const validateOptionalText = (
  value: string,
  label: string,
  options: { max?: number } = {},
): string | null => {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (options.max && trimmed.length > options.max) {
    return `${label} must be ${options.max} characters or fewer.`
  }
  return null
}

/** Positive integer parser used by BPM, capo and duration fields. */
export const parseOptionalPositiveInt = (value: string): number | null => {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const parsed = Number.parseInt(trimmed, 10)
  if (Number.isNaN(parsed) || parsed < 0) return null
  return parsed
}

export const validateBpm = (value: string): string | null => {
  if (value.trim().length === 0) return null
  const parsed = Number(value.trim())
  if (Number.isNaN(parsed)) return "Enter a valid tempo."
  if (parsed < 20 || parsed > 400) return "Tempo must be between 20 and 400 BPM."
  return null
}

export const validateCapo = (value: string): string | null => {
  if (value.trim().length === 0) return null
  const parsed = Number(value.trim())
  if (Number.isNaN(parsed) || !Number.isInteger(parsed)) return "Capo must be a whole fret number."
  if (parsed < 0 || parsed > 12) return "Capo must be between 0 and 12."
  return null
}

export const validateDuration = (value: string): string | null => {
  if (value.trim().length === 0) return null
  if (!/^\d{1,2}:\d{2}$/.test(value.trim())) return "Use mm:ss, for example 3:45."
  const [, minutes, seconds] = /^(\d{1,2}):(\d{2})$/.exec(value.trim()) ?? []
  if (Number(seconds) > 59) return "Seconds must be 00-59."
  if (minutes === undefined) return "Use mm:ss, for example 3:45."
  return null
}

/** Throwing variant used by services so screens only render one message. */
export const ensure = (message: string | null, field?: string): void => {
  if (message) throw new ValidationError(message, field)
}

/** `yyyy-mm-dd` for date inputs and Firestore queries. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const toIsoDate = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

export const parseIsoDate = (value: string): Date | null => {
  if (!ISO_DATE_PATTERN.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
  return Number.isNaN(date.getTime()) ? null : date
}

/** `HH:mm` 24h time input. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const validateTime = (value: string, label: string): string | null => {
  if (value.trim().length === 0) return null
  if (!TIME_PATTERN.test(value.trim())) return `Enter ${label.toLowerCase()} as HH:mm (24h).`
  return null
}

/** Turns a comma/space separated tag input into a clean, unique tag list. */
export const parseTags = (value: string): string[] => {
  const parts = value
    .split(/[,\n]/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0 && part.length <= 24)
  return Array.from(new Set(parts)).slice(0, 12)
}

export const validateTags = (value: string): string | null => {
  if (parseTags(value).length > 12) return "Use at most 12 tags."
  return null
}
/**
 * Centralised, human friendly error handling.
 *
 * Raw Firebase errors are never shown to users: every code is translated into a
 * short, actionable sentence (docs §25).
 */

const AUTH_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/missing-email": "Enter your email address.",
  "auth/missing-password": "Enter your password.",
  "auth/weak-password": "Passwords need at least 6 characters.",
  "auth/email-already-in-use": "An account already exists for that email. Try signing in.",
  "auth/user-not-found": "We couldn't find an account with that email.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/invalid-login-credentials": "Incorrect email or password.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/too-many-requests": "Too many attempts. Please wait a minute and try again.",
  "auth/network-request-failed": "No connection. Check your internet and try again.",
  "auth/requires-recent-login": "Please sign in again to continue.",
  "auth/operation-not-allowed": "Email sign-in isn't enabled for this project yet.",
  "auth/popup-closed-by-user": "The sign-in window was closed before finishing.",
  "auth/account-exists-with-different-credential":
    "That email is linked to a different sign-in method.",
}

const FIRESTORE_MESSAGES: Record<string, string> = {
  "permission-denied": "Only organization admins can do that.",
  unauthenticated: "Your session expired. Please sign in again.",
  unavailable: "No connection right now. We'll sync as soon as you're back online.",
  "deadline-exceeded": "That took too long. Please try again.",
  "not-found": "We couldn't find what you were looking for.",
  "already-exists": "That already exists.",
  "resource-exhausted": "Too many requests right now. Please try again shortly.",
  aborted: "Someone else updated this at the same time. Please try again.",
  cancelled: "The operation was cancelled.",
  internal: "Something went wrong on our side. Please try again.",
  "invalid-argument": "Some of the information provided is invalid.",
  "failed-precondition": "That action isn't possible right now.",
  unknown: "Something went wrong. Please try again.",
}

const STORAGE_MESSAGES: Record<string, string> = {
  "storage/unauthorized": "You don't have permission to upload that file.",
  "storage/canceled": "The upload was cancelled.",
  "storage/quota-exceeded": "You ran out of storage. Try a smaller image.",
  "storage/retry-limit-exceeded": "The upload failed after several attempts.",
  "storage/unknown": "The upload failed. Please try again.",
}

/**
 * Native Google Sign-In failures. Android reports numeric status codes
 * (GoogleSignInStatusCodes) while the JS SDK adds named ones, and unmapped
 * codes would otherwise collapse into the generic fallback message.
 */
const GOOGLE_MESSAGES: Record<string, string> = {
  "4": "Choose a Google account to continue.",
  "7": "No connection right now. Check your internet and try again.",
  "8": "Google Play Services had a hiccup. Please try again.",
  "10": "Google sign-in isn't configured for this build. Check the app's signing key in Firebase.",
  "16": "Google sign-in was cancelled.",
  "12500": "Google couldn't complete the sign-in. Please try again.",
  "12502": "Google sign-in is already in progress.",
  IN_PROGRESS: "Google sign-in is already in progress.",
  PLAY_SERVICES_NOT_AVAILABLE: "Google Play Services is missing or needs an update on this device.",
  SIGN_IN_REQUIRED: "Choose a Google account to continue.",
  NULL_PRESENTER: "Google sign-in isn't ready yet. Try again in a moment.",
}

/** Extracts the `code` of a Firebase error (`auth/...`, `permission-denied`...). */
export const errorCode = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null
  const candidate = error as { code?: unknown; message?: unknown }
  if (typeof candidate.code === "string" && candidate.code.length > 0) return candidate.code
  // Firestore occasionally reports "FirebaseError: ... [code=permission-denied]".
  if (typeof candidate.message === "string") {
    const match = /\[code=([a-z0-9-]+)\]/.exec(candidate.message)
    if (match) return match[1]
  }
  return null
}

const OFFLINE_PATTERN = /offline|network request failed|failed to fetch|networkerror/i

/**
 * Converts any thrown value into a friendly, user-facing message.
 */
export const toFriendlyError = (error: unknown, fallback?: string): string => {
  const code = errorCode(error)
  if (code) {
    const known =
      AUTH_MESSAGES[code] ??
      GOOGLE_MESSAGES[code] ??
      FIRESTORE_MESSAGES[code] ??
      STORAGE_MESSAGES[code] ??
      undefined
    if (known) return known
  }

  if (error instanceof Error) {
    if (OFFLINE_PATTERN.test(error.message)) {
      return "No connection right now. Check your internet and try again."
    }
    // Validation errors raised by our own services are already user safe.
    if (error.name === "ValidationError") return error.message
    return fallback ?? "Something went wrong. Please try again."
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return fallback ?? "Something went wrong. Please try again."
  }

  return fallback ?? "Something went wrong. Please try again."
}

/** True when the failure was caused by Firestore rules. */
export const isPermissionError = (error: unknown): boolean => errorCode(error) === "permission-denied"

/** True when the device appears to be offline. */
export const isOfflineError = (error: unknown): boolean => {
  const code = errorCode(error)
  if (code === "unavailable" || code === "auth/network-request-failed") return true
  const message = error instanceof Error ? error.message : ""
  return OFFLINE_PATTERN.test(message)
}

/**
 * Error thrown by our own validation helpers. Kept separate from Firebase
 * errors so screens can show the message verbatim.
 */
export class ValidationError extends Error {
  readonly field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = "ValidationError"
    this.field = field
  }
}

export const assertNever = (value: never): never => {
  throw new ValidationError(`Unexpected value: ${String(value)}`)
}
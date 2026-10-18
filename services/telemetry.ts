import { getAnalytics, logEvent, setAnalyticsCollectionEnabled } from "@react-native-firebase/analytics"
import {
  getCrashlytics,
  setCrashlyticsCollectionEnabled,
} from "@react-native-firebase/crashlytics"

import { FUNNEL_EVENTS, type FunnelEvent, type FunnelParams } from "@/libs/telemetry"

/**
 * Consent-gated telemetry (roadmap #73). Collection starts **off at build
 * time** — `firebase.json`'s `react-native.analytics_auto_collection_enabled`
 * and `crashlytics_auto_collection_enabled` are false — and only the user's
 * stored choice (`UserPreferences.telemetry`, stamped at sign-up from the
 * asked answer or flipped in Settings) ever turns it on. This mirror of the
 * choice keeps a funnel event from reaching the SDK in the window before the
 * native flag flips, and makes the whole thing fail-safe: any wiring mistake
 * leaves the device collecting nothing.
 *
 * Web collects nothing at all — see `services/telemetry.web.ts`.
 */
let consented = false

/**
 * A new profile document coming into existence *is* the completed sign-up, so
 * the funnel's first step is noted there (both the email and the Google path).
 * The event itself is still consent-gated: a user who never opted in never
 * logs it, and one who opts in later logs it from that moment — nothing is
 * ever back-dated.
 */
let signupNoted = false

const flushSignupEvent = (): void => {
  if (!consented || !signupNoted) return
  signupNoted = false
  safeLog(FUNNEL_EVENTS.signUpCompleted)
}

const safeLog = (event: FunnelEvent, params?: FunnelParams): void => {
  try {
    // Fire-and-forget like `logActivity`: telemetry never breaks the app.
    logEvent(getAnalytics(), event, params)
  } catch {
    // A missing or unconfigured native module only means no collection.
  }
}

/** Syncs the native collection flags with the user's stored choice. */
export const applyTelemetryConsent = (enabled: boolean): void => {
  if (enabled !== consented) {
    consented = enabled
    try {
      void setAnalyticsCollectionEnabled(getAnalytics(), enabled).catch(() => undefined)
      void setCrashlyticsCollectionEnabled(getCrashlytics(), enabled).catch(() => undefined)
    } catch {
      // Telemetry never breaks the app.
    }
  }
  // Every re-apply gets a chance to release a sign-up noted a moment ago: the
  // profile write and its listener echo can land in either order.
  if (enabled) flushSignupEvent()
}

/** Called when a brand-new profile document is written (see above). */
export const noteSignUpCompleted = (): void => {
  signupNoted = true
  flushSignupEvent()
}

/** One funnel event, dropped while the user has not opted in. */
export const logFunnelEvent = (event: FunnelEvent, params?: FunnelParams): void => {
  if (!consented) return
  safeLog(event, params)
}

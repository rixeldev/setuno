import type { FunnelEvent, FunnelParams } from "@/libs/telemetry"

/**
 * Web shim (roadmap #73): analytics and Crashlytics are native-only in this
 * app — the web build collects nothing on purpose, so consent there only
 * records the account-level choice (it follows the user to their phone)
 * and every funnel call is a no-op. Metro resolves this file for platform=web.
 */
export const applyTelemetryConsent = (enabled: boolean): void => {
  void enabled
}

export const noteSignUpCompleted = (): void => undefined

export const logFunnelEvent = (event: FunnelEvent, params?: FunnelParams): void => {
  void event
  void params
}

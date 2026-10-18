import { getApp } from "@react-native-firebase/app"
import {
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
} from "@react-native-firebase/app-check"

/**
 * App Check (roadmap #72): every Firestore/Storage/callable request carries an
 * attestation token, so a leaked API key cannot burn the band's bill. The
 * rollout itself is console work — enroll each platform, register the debug
 * token, watch monitor mode, then enforce (README's App Check section) — and
 * **no security rule changes with it**.
 *
 * Providers per platform: Play Integrity on Android and
 * App Attest-with-DeviceCheck-fallback on Apple in release builds; the **debug**
 * provider in development, whose token is registered once in the Firebase
 * console (Project settings → App Check → manage debug tokens) — either the
 * temporary secret the device logs on first launch, or
 * `EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN` baked into a dev build through `eas.json`
 * env (never into a release build).
 *
 * Attestation is anti-abuse protection, not telemetry: it is deliberately
 * **not** gated on the analytics consent (#73) — once enforcement is on, a
 * client that never fetches tokens simply stops working.
 *
 * Web is a no-op (`services/appCheck.web.ts`): the browser provider needs a
 * reCAPTCHA Enterprise site key registered in the console, so until web is
 * enrolled the build sends no attestation — which is exactly why enforcement
 * must stay in monitor mode until every platform has been enrolled.
 */

let started = false

const debugToken = process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN

/** Idempotent, fire-and-forget: startup calls it once, failures stay quiet. */
export const startAppCheck = (): void => {
  if (started) return
  started = true
  try {
    const provider = new ReactNativeFirebaseAppCheckProvider()
    provider.configure({
      android: {
        provider: __DEV__ ? "debug" : "playIntegrity",
        ...(debugToken ? { debugToken } : {}),
      },
      apple: {
        provider: __DEV__ ? "debug" : "appAttestWithDeviceCheckFallback",
        ...(debugToken ? { debugToken } : {}),
      },
    })
    // Returns the AppCheck instance and kicks off the native initialization
    // internally; a platform the console has not enrolled yet fails quietly on
    // the native side, and monitor mode tolerates unattested traffic — so a
    // missing enrollment must never keep the band out of the songbook.
    initializeAppCheck(getApp(), {
      provider,
      isTokenAutoRefreshEnabled: true,
    })
  } catch {
    // Synchronous wiring errors only mean no attestation, never no app.
  }
}

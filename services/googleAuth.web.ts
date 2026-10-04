// Web Google sign-in (browser).
//
// The browser flow uses a Firebase popup, with a full-page redirect fallback
// when the popup is blocked. `GoogleSignin` is a native-only SDK, which is why
// the web platform gets its own implementation file: Metro resolves
// `<name>.web.ts` before `<name>.ts` for `platform=web`, and the generic file
// on Android/iOS.
//
// NOTE ON TYPES: Expo's tsconfig resolves `firebase/auth` through the
// `react-native` condition, whose type surface omits the browser-only popup and
// redirect helpers (that is also why `getReactNativePersistence` resolves).
// Metro maps the same specifier onto the browser build for `platform=web`, so
// those functions are present at runtime — this file describes the narrow slice
// it depends on instead of reaching for `any`.
import * as firebaseAuth from "firebase/auth"

import { auth } from "@/db/firebaseConfig"

/** Structural view of a Google auth provider as used by the popup/redirect API. */
interface WebProvider {
  providerId: string
  setCustomParameters: (params: Record<string, string>) => void
}

/** Structural view of the browser-only popup/redirect resolver. */
type WebResolver = Record<string, unknown>

interface WebAuthApi {
  GoogleAuthProvider: new () => WebProvider
  /**
   * `db/firebaseConfig.ts` calls the shared `initializeAuth(app, { persistence })`
   * without a `popupRedirectResolver` (React Native Firebase's `initializeAuth`
   * has no such option). The JS SDK then asserts on `auth._popupRedirectResolver`
   * and every popup/redirect call fails with `auth/argument-error`, so the
   * resolver is supplied explicitly at each call site instead of changing the
   * shared config.
   */
  browserPopupRedirectResolver: WebResolver
  signInWithPopup: (
    auth: firebaseAuth.Auth,
    provider: WebProvider,
    resolver: WebResolver,
  ) => Promise<firebaseAuth.UserCredential>
  signInWithRedirect: (
    auth: firebaseAuth.Auth,
    provider: WebProvider,
    resolver: WebResolver,
  ) => Promise<void>
  getRedirectResult: (
    auth: firebaseAuth.Auth,
    resolver: WebResolver,
  ) => Promise<firebaseAuth.UserCredential | null>
}

const web = firebaseAuth as unknown as WebAuthApi

/** `auth` is exported as the RNFB type but is a firebase-js-sdk `Auth` on web. */
const webAuth = auth as unknown as firebaseAuth.Auth

const createProvider = (): WebProvider => {
  const provider = new web.GoogleAuthProvider()
  // Always ask which account to use so testers can switch Google identities.
  provider.setCustomParameters({ prompt: "select_account" })
  return provider
}

/** Completes a sign-in started with `signInWithRedirect`. Resolves to null when idle. */
void web.getRedirectResult(webAuth, web.browserPopupRedirectResolver).catch(() => undefined)

/** Popup dismissal is normal user behaviour, not a failure. */
const isCancellation = (error: unknown): boolean => {
  if (!error || typeof error !== "object" || !("code" in error)) return false
  const code = String(error.code)
  return (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/user-cancelled"
  )
}

const isPopupBlocked = (error: unknown): boolean => {
  if (!error || typeof error !== "object" || !("code" in error)) return false
  const code = String(error.code)
  return (
    code === "auth/popup-blocked" ||
    code === "auth/operation-not-supported-in-this-environment"
  )
}

/**
 * Starts the browser Google sign-in flow.
 *
 * @returns `true` once the popup resolves with a session, `false` when the
 * user dismissed it or when the redirect fallback took over (the page reloads).
 */
export const signInWithGoogle = async (): Promise<boolean> => {
  try {
    await web.signInWithPopup(webAuth, createProvider(), web.browserPopupRedirectResolver)
    return true
  } catch (error) {
    if (isCancellation(error)) return false
    if (isPopupBlocked(error)) {
      await web.signInWithRedirect(webAuth, createProvider(), web.browserPopupRedirectResolver)
      return false
    }
    throw error
  }
}

/** Firebase owns the browser session; there is no native SDK to reset. */
export const revokeGoogleSession = async (): Promise<void> => {
  // No-op on web.
}

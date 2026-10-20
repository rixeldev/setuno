import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  EmailAuthProvider,
  isSignInWithEmailLink,
  reauthenticateWithCredential,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from "@react-native-firebase/auth"

import { auth, firebaseConfig } from "@/db/firebaseConfig"
import { normalizeEmail } from "@/db/Fire"
import { emailLinkContinueUrl as buildContinueUrl } from "@/libs/emailLink"
// The share links' origin resolver is really a "browser origin, else
// `EXPO_PUBLIC_WEB_BASE_URL`, else null" helper wearing a share-shaped name —
// the same question this flow asks, so the seam is reused rather than copied.
import { resolveShareBaseUrl as resolveWebOrigin } from "@/libs/shareLink"

/**
 * Email-link (passwordless) sign-in (roadmap #67).
 *
 * **One service, no platform split**: React Native Firebase v26 and the JS SDK
 * v1.13 expose this half of the Auth API with identical signatures, so the
 * web shim (`export * from "firebase/auth"`) serves it as-is and the flow is
 * written exactly once.
 *
 * The link itself is minted by Firebase Hosting and pointed at by the email:
 * `PROJECT_ID.firebaseapp.com/__/auth/links?…&continueUrl=…`. A phone with the
 * app installed opens it through Android App Links (declared in
 * `app.config.js`); everywhere else the handler hands the one-time code to the
 * continue URL, which is this app's own `/email-link` route. Both halves arrive
 * there and finish through `completeEmailSignInLink`.
 */

/**
 * Mirrors `app.config.js`. The Android/iOS hints are what make Firebase build
 * an App Link instead of a plain web link — without them the email would only
 * ever open the browser.
 */
const APP_PACKAGE = "com.rixeldev.setuno"

/**
 * The address the browser must come back to. Live origin when there is one
 * (every deployment is then automatically correct and already authorized),
 * `EXPO_PUBLIC_WEB_BASE_URL` on a phone build, and the project's own
 * `authDomain` as the last resort — always an authorized domain, so a build
 * with no web address configured can still *send* the link.
 */
const continueUrl = (): string => buildContinueUrl(resolveWebOrigin(), firebaseConfig.authDomain)

/** AsyncStorage key holding the address the link was requested for. */
const PENDING_EMAIL_KEY = "setuno:email-link:pending-email"

const storePendingEmail = async (email: string): Promise<void> => {
  await AsyncStorage.setItem(PENDING_EMAIL_KEY, email).catch(() => undefined)
}

/** The email a link was sent to on *this* device, if it still knows it. */
export const readPendingEmailLink = async (): Promise<string | null> => {
  const stored = await AsyncStorage.getItem(PENDING_EMAIL_KEY).catch(() => null)
  return stored && stored.trim().length > 0 ? stored : null
}

/** Forgets the pending address — a completed or abandoned round trip. */
export const clearPendingEmailLink = async (): Promise<void> => {
  await AsyncStorage.removeItem(PENDING_EMAIL_KEY).catch(() => undefined)
}

/**
 * Requests the sign-in link. Firebase already knows this address is the one
 * asking (it just sent the mail), so the answer never reveals whether an
 * account exists — the enumeration-safe behaviour the app wants everywhere.
 */
export const sendEmailSignInLink = async (email: string): Promise<void> => {
  const normalized = normalizeEmail(email)
  await sendSignInLinkToEmail(auth, normalized, {
    url: continueUrl(),
    handleCodeInApp: true,
    iOS: { bundleId: APP_PACKAGE },
    android: { packageName: APP_PACKAGE, installApp: true },
  })
  // Only remembered once the mail really went out: a failed request must not
  // leave an address behind for a later completion to pick up.
  await storePendingEmail(normalized)
}

/**
 * True when `url` is a sign-in link waiting to be finished.
 *
 * `auth.currentUser` is deliberately *not* consulted here: a link opened by an
 * already signed-in member is a **re-authentication** (#68's challenge), and
 * deciding that is `completeEmailSignInLink`'s job.
 */
export const isEmailSignInLink = (url: string): boolean => isSignInWithEmailLink(auth, url)

/**
 * Sign-in links are one-time, but `expo-linking` keeps reporting the URL that
 * launched the session until something else replaces it — so without this
 * guard a later visit to the route would happily re-open a spent code and
 * show the user a confusing "invalid link" error.
 */
const spentLinks = new Set<string>()

/** True when this link was already redeemed and its one-time code is spent. */
export const isEmailLinkSpent = (url: string): boolean => spentLinks.has(url)

/** Which half of the flow the arriving link turned out to be. */
export type EmailLinkOutcome = "signin" | "reauth"

/**
 * Finishes the round trip.
 *
 * - Signed out → a normal sign-in, exactly what the sign-in screen asked for.
 * - Signed in → the same one-time code re-proves who the member is, so it is
 *   consumed as the re-authentication the account-deletion dialog demands.
 *   An email that belongs to somebody else then fails with `user-mismatch`
 *   instead of silently swapping the session.
 */
const completeEmailSignInLink = async (
  url: string,
  email: string,
): Promise<EmailLinkOutcome> => {
  const user = auth.currentUser
  if (user) {
    const credential = EmailAuthProvider.credentialWithLink(email, url)
    await reauthenticateWithCredential(user, credential)
    spentLinks.add(url)
    return "reauth"
  }
  await signInWithEmailLink(auth, email, url)
  spentLinks.add(url)
  return "signin"
}

/**
 * The redemption is **memoized per link**, and that is not a cache for its own
 * sake: React StrictMode runs an effect twice in development, and two attempts
 * at the same one-time code would spend it and lose a sign-in that actually
 * worked. Both runs await the same promise here. The same memo also means a
 * later visit to the route — the native launch URL keeps being reported for
 * the whole session — replays the *result* instead of redeeming a spent code.
 */
const redemptions = new Map<string, Promise<EmailLinkOutcome>>()

/** Redeems the arriving link, at most once per link. */
export const redeemEmailSignInLink = (
  url: string,
  email: string,
): Promise<EmailLinkOutcome> => {
  const cached = redemptions.get(url)
  if (cached) return cached
  const promise = completeEmailSignInLink(url, email)
  redemptions.set(url, promise)
  // A failure is not remembered forever: a new email carries a new URL, so a
  // fresh key is always a fresh attempt.
  void promise.catch(() => {
    redemptions.delete(url)
  })
  return promise
}

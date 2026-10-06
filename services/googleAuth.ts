// Native Google sign-in (Android / iOS).
//
// `GoogleSignin` obtains a Google ID token which is exchanged for a Firebase
// credential, so the resulting session is identical to the email/password one:
// `ensureUserProfile` backfills `users/{uid}` and the organization listeners
// pick the account up exactly as they would for any other sign-in.
//
// This file is the native implementation. Metro resolves `googleAuth.web.ts`
// for the web bundle (platform extension), so the browser never pulls in a
// native-only SDK.
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin"
import { GoogleAuthProvider, signInWithCredential } from "@react-native-firebase/auth"

import { auth } from "@/db/firebaseConfig"

let configured = false

const configure = (): void => {
  if (configured) return
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  })
  configured = true
}

/** Google Sign-In cancels are normal user behaviour, not failures. */
const isCancellation = (error: unknown): boolean => {
  if (!error || typeof error !== "object" || !("code" in error)) return false
  const code = String(error.code)
  return code === "-5" || code === "12501" || code === "SIGN_IN_CANCELLED"
}

/**
 * Starts the native Google sign-in flow.
 *
 * @returns `true` when a Firebase session was created, `false` when the user
 * backed out of the account picker (nothing to report in that case).
 */
export const signInWithGoogle = async (): Promise<boolean> => {
  configure()
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const response = await GoogleSignin.signIn()
    if (!isSuccessResponse(response)) return false
    // The ID token already travels in the sign-in response: using it directly
    // avoids the extra `getTokens()` network round-trip, which was the slow,
    // flaky step of the flow. Fall back only when the token is missing.
    const idToken = response.data.idToken ?? (await GoogleSignin.getTokens()).idToken
    if (!idToken) throw new Error("Google did not return an ID token.")
    const credential = GoogleAuthProvider.credential(idToken)
    await signInWithCredential(auth, credential)
    return true
  } catch (error) {
    if (isCancellation(error)) return false
    throw error
  }
}

/**
 * Clears the locally cached Google session during sign-out. Best effort: a
 * user who never signed in with Google (or an unconfigured SDK) must still be
 * able to sign out normally.
 */
export const revokeGoogleSession = async (): Promise<void> => {
  try {
    await GoogleSignin.signOut()
  } catch {
    // Nothing to revoke.
  }
}

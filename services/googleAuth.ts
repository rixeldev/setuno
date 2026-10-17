// Native Google sign-in (Android / iOS).
//
// `GoogleSignin` obtains Google sign-in tokens (an ID token when a web client
// ID is configured, an access token otherwise) and exchanges them for a
// Firebase credential, so the resulting session is identical to the
// email/password one: `ensureUserProfile` backfills `users/{uid}` and the
// organization listeners pick the account up exactly as they would for any
// other sign-in.
//
// This file is the native implementation. Metro resolves `googleAuth.web.ts`
// for the web bundle (platform extension), so the browser never pulls in a
// native-only SDK.
import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin"
import {
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
} from "@react-native-firebase/auth"

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

    // Fast path: the ID token that travels with the response saves a network
    // round-trip (it is only present when a web client ID is configured).
    // A rejected credential must never end the flow, so the classic exchange
    // below stays as the reliable fallback.
    const responseToken = response.data.idToken?.trim()
    if (responseToken) {
      try {
        await signInWithCredential(auth, GoogleAuthProvider.credential(responseToken))
        return true
      } catch {
        // Fall through to the full token exchange.
      }
    }

    const tokens = await GoogleSignin.getTokens()
    // Firebase builds a valid credential from the ID token, the access token or
    // both. Some Android setups cannot request an ID token (no web client ID
    // configured), so the access-token-only case must keep working: only having
    // neither token is fatal.
    if (!tokens.idToken && !tokens.accessToken) {
      throw new Error("Google did not return sign-in tokens.")
    }
    await signInWithCredential(
      auth,
      GoogleAuthProvider.credential(tokens.idToken, tokens.accessToken),
    )
    return true
  } catch (error) {
    if (isCancellation(error)) return false
    throw error
  }
}

/**
 * Re-proves the Google identity ahead of a sensitive operation (roadmap #68's
 * account deletion): the same picker as sign-in, exchanged against the
 * **current** session. The flow mirrors `signInWithGoogle`'s token handling,
 * access-token-only Android setups included.
 *
 * @returns `true` once the credential was accepted, `false` when the user
 * backed out of the picker (the caller simply stays where it was).
 */
export const reauthenticateWithGoogle = async (): Promise<boolean> => {
  configure()
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const response = await GoogleSignin.signIn()
    if (!isSuccessResponse(response)) return false

    const user = auth.currentUser
    if (!user) throw new Error("You need to be signed in to do that.")

    const responseToken = response.data.idToken?.trim()
    if (responseToken) {
      try {
        await reauthenticateWithCredential(user, GoogleAuthProvider.credential(responseToken))
        return true
      } catch {
        // Fall through to the full token exchange, like sign-in does.
      }
    }

    const tokens = await GoogleSignin.getTokens()
    if (!tokens.idToken && !tokens.accessToken) {
      throw new Error("Google did not return sign-in tokens.")
    }
    await reauthenticateWithCredential(
      user,
      GoogleAuthProvider.credential(tokens.idToken, tokens.accessToken),
    )
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

// Native Sign in with Apple (iOS).
//
// The App Store asks for it whenever an app offers another social sign-in —
// and Setuno offers Google — so the button has to exist before the iOS build
// does (roadmap #66).
//
// Apple's flow returns an **identity token**, which Firebase exchanges for a
// session exactly like the Google one: `ensureUserProfile` backfills
// `users/{uid}` and the organization listeners pick the account up as usual.
//
// Two details only Apple has:
//
//   • The **name** travels with the credential **only the first time** the
//     member authorizes the app. It is handed to the credential right away, so
//     the profile is written with it and never has to be asked for again.
//   • The **email** may be a *private relay* address (`…@privaterelay.
//     appleid.com`) when the member chose to hide it. It is a real address —
//     Apple forwards it — so it is simply used as the account's email, never
//     "fixed" or second-guessed.
//
// This file is the native implementation. Metro resolves `appleAuth.web.ts` for
// the web bundle, so the browser never pulls in a native-only SDK.
import * as AppleAuthentication from "expo-apple-authentication"
import { OAuthProvider, signInWithCredential } from "@react-native-firebase/auth"

import { auth } from "@/db/firebaseConfig"

const provider = new OAuthProvider("apple.com")

/** True where the platform can show Apple's sheet at all (iOS, yes; Android, no). */
export const isAppleSignInAvailable = async (): Promise<boolean> => {
  try {
    return await AppleAuthentication.isAvailableAsync()
  } catch {
    // An SDK that cannot answer is an SDK that cannot sign anybody in.
    return false
  }
}

/** The full name Apple gave, if any: "Ada" + "Lovelace" → "Ada Lovelace". */
const fullNameOf = (name: AppleAuthentication.AppleAuthenticationFullName | null): string => {
  if (!name) return ""
  return [name.givenName, name.familyName].filter((part) => Boolean(part)).join(" ")
}

/**
 * Starts the Sign in with Apple flow.
 *
 * @returns `true` when a Firebase session was created, `false` when the
 * platform cannot offer it (Android, web) or the member backed out.
 */
export const signInWithApple = async (): Promise<boolean> => {
  if (!(await isAppleSignInAvailable())) return false
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    })
    if (!credential.identityToken) return false

    const displayName = fullNameOf(credential.fullName)
    await signInWithCredential(
      auth,
      provider.credential({
        idToken: credential.identityToken,
        ...(displayName ? { displayName } : {}),
        ...(credential.email ? { email: credential.email } : {}),
      }),
    )
    return true
  } catch (error) {
    if (isCancellation(error)) return false
    throw error
  }
}

/** Apple sign-in cancels are normal user behaviour, not failures. */
const isCancellation = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false
  const code = "code" in error ? String(error.code) : ""
  const message = "message" in error ? String(error.message) : ""
  return (
    code === "ERR_CANCELED" ||
    code === "ERR_REQUEST_CANCELED" ||
    message.toLowerCase().includes("canceled")
  )
}

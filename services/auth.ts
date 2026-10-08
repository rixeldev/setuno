import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as updateAuthProfile,
} from "@react-native-firebase/auth"
import type { User } from "@react-native-firebase/auth"

import { auth } from "@/db/firebaseConfig"
import { toFriendlyError } from "@/services/errors"
import { normalizeEmail } from "@/db/Fire"
import {
  revokeGoogleSession,
  signInWithGoogle as googleSignIn,
} from "@/services/googleAuth"

export type AuthListener = (user: User | null) => void

/** Subscribes to Firebase Auth state. Returns the unsubscribe function. */
export const subscribeAuthState = (listener: AuthListener): (() => void) =>
  onAuthStateChanged(auth, (user) => listener(user))

export const getCurrentUser = (): User | null => auth.currentUser

export interface RegisterInput {
  email: string
  password: string
  displayName: string
}

/** Creates the Firebase Auth account. Profile docs are written by users.ts. */
export const registerWithEmail = async (input: RegisterInput): Promise<User> => {
  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      normalizeEmail(input.email),
      input.password,
    )
    const displayName = input.displayName.trim()
    if (displayName.length > 0) {
      await updateAuthProfile(credential.user, { displayName })
      // Refresh so consumers immediately observe the new display name.
      await credential.user.reload()
    }
    return credential.user
  } catch (error) {
    throw new Error(toFriendlyError(error, "We couldn't create your account. Please try again."))
  }
}

export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    const credential = await signInWithEmailAndPassword(auth, normalizeEmail(email), password)
    return credential.user
  } catch (error) {
    throw new Error(toFriendlyError(error, "We couldn't sign you in. Please try again."))
  }
}

export const signOut = async (): Promise<void> => {
  try {
    await revokeGoogleSession()
    await firebaseSignOut(auth)
  } catch (error) {
    throw new Error(toFriendlyError(error, "We couldn't sign you out. Please try again."))
  }
}

/**
 * Google sign-in (popup on web, native account picker on Android).
 *
 * Resolves to `true` when a session was created and `false` when the user
 * dismissed the picker — a dismissal must never surface as an error.
 */
export const signInWithGoogle = async (): Promise<boolean> => {
  try {
    return await googleSignIn()
  } catch (error) {
    throw new Error(
      toFriendlyError(error, "We couldn't sign you in with Google. Please try again."),
    )
  }
}

/** Sends the password reset email. Never reveals whether an account exists. */
export const sendPasswordReset = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, normalizeEmail(email))
  } catch (error) {
    throw new Error(toFriendlyError(error, "We couldn't send the reset email. Please try again."))
  }
}

/** Keeps the Firebase Auth display name in sync with the Setuno profile. */
export const updateAuthDisplayName = async (displayName: string): Promise<void> => {
  const user = auth.currentUser
  if (!user) throw new Error("You need to be signed in to do that.")
  await updateAuthProfile(user, { displayName: displayName.trim() })
}

export const updateAuthPhotoUrl = async (photoURL: string): Promise<void> => {
  const user = auth.currentUser
  if (!user) throw new Error("You need to be signed in to do that.")
  await updateAuthProfile(user, { photoURL })
}
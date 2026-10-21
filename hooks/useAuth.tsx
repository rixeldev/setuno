import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { User } from "@react-native-firebase/auth"

import {
  getCurrentUser,
  registerWithEmail,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle as googleSignIn,
  signOut as signOutUser,
  subscribeAuthState,
} from "@/services/auth"
import { ensureUserProfile, subscribeUserProfile, updateUserProfile } from "@/services/users"
import { signInWithApple as appleSignIn } from "@/services/appleAuth"
import type { UserProfile, UserProfileUpdate } from "@/interfaces"

export type AuthStatus = "initializing" | "signed-out" | "signed-in"

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  profile: UserProfile | null
  signIn: (email: string, password: string) => Promise<void>
  /** Google sign-in. Resolves `false` when the user dismissed the picker. */
  signInWithGoogle: () => Promise<boolean>
  /** Sign in with Apple (roadmap #66). Resolves `false` when the platform has no Apple button. */
  signInWithApple: () => Promise<boolean>
  signUp: (input: { email: string; password: string; displayName: string }) => Promise<void>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updateProfile: (update: UserProfileUpdate) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Single source of truth for the signed-in user and their Setuno profile.
 * Keeps Firebase Auth and `users/{uid}` in sync and exposes a stable API to
 * the rest of the app.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("initializing")
  const [user, setUser] = useState<User | null>(getCurrentUser())
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const profileUnsubscribe = useRef<(() => void) | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeAuthState((nextUser) => {
      setUser(nextUser)
      setStatus(nextUser ? "signed-in" : "signed-out")

      profileUnsubscribe.current?.()
      profileUnsubscribe.current = null
      setProfile(null)

      if (!nextUser) return
      // Keep the profile live straight away (cache-first) and backfill the
      // document in the background: a slow or offline `getDoc` must never hold
      // up the session, which is what made cold starts feel stuck.
      profileUnsubscribe.current = subscribeUserProfile(nextUser.uid, setProfile)
      void ensureUserProfile({
        uid: nextUser.uid,
        email: nextUser.email ?? "",
        displayName: nextUser.displayName ?? "",
        photoURL: nextUser.photoURL,
      }).catch(() => undefined)
    })

    return () => {
      unsubscribe()
      profileUnsubscribe.current?.()
      profileUnsubscribe.current = null
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmail(email, password)
  }, [])

  const signInWithGoogle = useCallback(async (): Promise<boolean> => googleSignIn(), [])

  const signInWithApple = useCallback(async (): Promise<boolean> => appleSignIn(), [])

  const signUp = useCallback(
    async (input: { email: string; password: string; displayName: string }) => {
      const user = await registerWithEmail(input)
      // The account's name is set right after the account is created, so the
      // profile is written here with the real name — the account's own
      // backfill may have run a moment earlier, before the name was there.
      await ensureUserProfile({
        uid: user.uid,
        email: user.email ?? input.email,
        displayName: input.displayName,
        photoURL: user.photoURL,
      }).catch(() => undefined)
    },
    [],
  )

  const signOut = useCallback(async () => {
    await signOutUser()
  }, [])

  const sendReset = useCallback(async (email: string) => {
    await sendPasswordReset(email)
  }, [])

  const updateProfile = useCallback(
    async (update: UserProfileUpdate) => {
      if (!user) return
      await updateUserProfile(user.uid, update)
    },
    [user],
  )

  const refreshProfile = useCallback(async () => {
    if (!user) return
    await ensureUserProfile({
      uid: user.uid,
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      photoURL: user.photoURL,
    })
  }, [user])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      profile,
      signIn,
      signInWithGoogle,
      signInWithApple,
      signUp,
      signOut,
      sendPasswordReset: sendReset,
      updateProfile,
      refreshProfile,
    }),
    [status, user, profile, signIn, signInWithGoogle, signInWithApple, signUp, signOut, sendReset, updateProfile, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside an AuthProvider")
  return context
}

/** Convenience helper: the signed-in user's uid (null when signed out). */
export const useUserId = (): string | null => useAuth().user?.uid ?? null
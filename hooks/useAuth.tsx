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
import type { UserProfile, UserProfileUpdate } from "@/interfaces"

export type AuthStatus = "initializing" | "signed-out" | "signed-in"

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  profile: UserProfile | null
  signIn: (email: string, password: string) => Promise<void>
  /** Google sign-in. Resolves `false` when the user dismissed the picker. */
  signInWithGoogle: () => Promise<boolean>
  signUp: (input: { email: string; password: string; displayName: string }) => Promise<void>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updateProfile: (update: UserProfileUpdate) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Single source of truth for the signed-in user and their Stage Book profile.
 * Keeps Firebase Auth and `users/{uid}` in sync and exposes a stable API to
 * the rest of the app.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("initializing")
  const [user, setUser] = useState<User | null>(getCurrentUser())
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const profileUnsubscribe = useRef<(() => void) | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeAuthState(async (nextUser) => {
      setUser(nextUser)
      setStatus(nextUser ? "signed-in" : "signed-out")

      profileUnsubscribe.current?.()
      profileUnsubscribe.current = null
      setProfile(null)

      if (!nextUser) return
      // Create/backfill the profile document, then keep it live.
      try {
        await ensureUserProfile({
          uid: nextUser.uid,
          email: nextUser.email ?? "",
          displayName: nextUser.displayName ?? "",
          photoURL: nextUser.photoURL,
        })
      } catch {
        // The profile listener below will surface any read error.
      }
      profileUnsubscribe.current = subscribeUserProfile(nextUser.uid, setProfile)
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

  const signUp = useCallback(
    async (input: { email: string; password: string; displayName: string }) => {
      await registerWithEmail(input)
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
      signUp,
      signOut,
      sendPasswordReset: sendReset,
      updateProfile,
      refreshProfile,
    }),
    [status, user, profile, signIn, signInWithGoogle, signUp, signOut, sendReset, updateProfile, refreshProfile],
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
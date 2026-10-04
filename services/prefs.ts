import { useSyncExternalStore } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"

import { DEFAULT_PREFERENCES, type UserPreferences } from "@/interfaces"

/**
 * Local mirror of the user's display preferences (reader font size, chords
 * visible, motion). The profile document stays the source of truth for sync,
 * but this cache makes every setting available instantly at start-up — offline,
 * before the profile loads, or without an account at all (docs §32).
 */
const STORAGE_KEY = "stage-book:user-preferences:v1"

const listeners = new Set<() => void>()
let preferences: UserPreferences = DEFAULT_PREFERENCES
let snapshot = 0

const notify = (): void => {
  snapshot += 1
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = (): number => snapshot

/** Current preferences (defaults until the cache is hydrated). */
export const getCachedPreferences = (): UserPreferences => preferences

/** Live preferences; re-renders whenever a setting changes. */
export const usePreferences = (): UserPreferences =>
  useSyncExternalStore(subscribe, getCachedPreferences, getCachedPreferences)

/** Merges a patch into the cache and writes it to storage. */
export const updateCachedPreferences = (patch: Partial<UserPreferences>): UserPreferences => {
  preferences = { ...preferences, ...patch }
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)).catch(() => undefined)
  notify()
  return preferences
}

/** Replaces the cache (used when the profile arrives from the server). */
export const writeCachedPreferences = (next: Partial<UserPreferences>): UserPreferences =>
  updateCachedPreferences({ ...DEFAULT_PREFERENCES, ...next })

/** Restores the persisted preferences. Called once during app start-up. */
export const hydratePreferences = async (): Promise<UserPreferences> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      const value = parsed as Partial<UserPreferences>
      preferences = { ...DEFAULT_PREFERENCES, ...value }
      notify()
    }
  } catch {
    // A corrupted cache must never block the app: keep the defaults.
  }
  return preferences
}

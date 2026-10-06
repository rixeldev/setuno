import { useSyncExternalStore } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"

/**
 * Chords the user picked last in the chord pad.
 *
 * A device-local shortcut (muscle memory, not band data), shown at the top of
 * the palette next to the diatonic chords of the song key.
 */
const STORAGE_KEY = "stage-book:recent-chords:v1"
const MAX_RECENT = 10

const listeners = new Set<() => void>()
let chords: string[] = []

const notify = (): void => {
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Recently used chords, newest first. */
export const getRecentChords = (): string[] => chords

/** Live list of recent chords; re-renders whenever one is picked. */
export const useRecentChords = (): string[] =>
  useSyncExternalStore(subscribe, getRecentChords, getRecentChords)

/** Moves a chord to the front of the list (deduplicated, capped). */
export const rememberChord = (chord: string): void => {
  const value = chord.trim()
  if (value.length === 0) return
  const next = [value, ...chords.filter((entry) => entry !== value)].slice(0, MAX_RECENT)
  if (next.length === chords.length && next.every((entry, index) => entry === chords[index])) {
    return
  }
  chords = next
  notify()
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(chords)).catch(() => undefined)
}

/** Restores the list at start-up. */
export const hydrateRecentChords = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    chords = parsed.filter((entry): entry is string => typeof entry === "string").slice(0, MAX_RECENT)
    notify()
  } catch {
    // A corrupted shortcut list must never block the app.
  }
}

import AsyncStorage from "@react-native-async-storage/async-storage"

import { EMPTY_SONGBOOK, sanitizeSongbook, type SongbookState } from "@/libs/songbookState"

/**
 * The songbook's remembered filters and order (roadmap #37), one entry per band
 * **and** per user — two members of the same band opening the same library each
 * get their own, and switching bands never hands you someone else's facets.
 *
 * Local only, like every other display preference: no profile write, no rules
 * change, and it works offline. This is the storage half; the shape and its
 * recovery rules live in `libs/songbookState.ts` where they can be tested
 * without a device.
 */
const STORAGE_KEY = "setuno:songbook-state:v1"

type Registry = Record<string, SongbookState>
type Listener = (value: SongbookState) => void

const listeners = new Map<string, Set<Listener>>()
let registry: Registry = {}

const notify = (key: string): void => {
  const value = registry[key]
  if (!value) return
  listeners.get(key)?.forEach((listener) => listener(value))
}

const persist = (): void => {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(registry)).catch(() => undefined)
}

/** A blank identity is not a key: never write an entry nobody can read back. */
const usable = (key: string): boolean => key.length > 1 && key !== "/"

/** The saved state of one band/user, or the defaults while nothing has been written. */
export const readSongbook = (key: string): SongbookState => registry[key] ?? EMPTY_SONGBOOK

/**
 * Restores every saved entry at start-up. Called once from `app/_layout.tsx`
 * alongside the other hydrations, so a screen can read the right value
 * synchronously on its very first render instead of flashing the defaults.
 * A corrupted cache is discarded rather than thrown: the songbook simply opens
 * unfiltered.
 */
export const hydrateSongbookState = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        const next: Registry = {}
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (usable(key)) next[key] = sanitizeSongbook(value)
        }
        registry = next
      }
    }
  } catch {
    // A corrupted cache must never block the app: keep the defaults.
  }
  // Hand the restore to whoever is already listening. Registrations that arrive
  // later read `registry` directly, so no update is ever missed.
  for (const key of Array.from(listeners.keys())) notify(key)
}

/**
 * Watches one entry. The first delivery is scheduled rather than made straight
 * away, so a screen never finds `setState` running inside the effect body that
 * subscribes it — the value arrives on a microtask whether it was already in
 * memory or still on its way from storage.
 */
export const subscribeSongbook = (key: string, listener: Listener): (() => void) => {
  let group = listeners.get(key)
  if (!group) {
    group = new Set<Listener>()
    listeners.set(key, group)
  }
  group.add(listener)

  void Promise.resolve().then(() => {
    if (!listeners.get(key)?.has(listener)) return
    const value = registry[key]
    if (value) listener(value)
  })

  return () => {
    const current = listeners.get(key)
    if (!current) return
    current.delete(listener)
    if (current.size === 0) listeners.delete(key)
  }
}

/**
 * Merges a patch into one entry, writes it and tells its subscribers. Returns
 * the stored value so a caller can update itself directly when nothing is
 * subscribed yet.
 */
export const writeSongbook = (key: string, patch: Partial<SongbookState>): SongbookState => {
  const current = registry[key] ?? EMPTY_SONGBOOK
  const next: SongbookState = { ...current, ...patch }
  if (!usable(key)) return next
  registry[key] = next
  persist()
  notify(key)
  return next
}

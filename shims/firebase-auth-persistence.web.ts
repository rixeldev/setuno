// Web shim for `firebase/auth`.
//
// db/firebaseConfig.ts imports `getReactNativePersistence` from "firebase/auth".
// That helper only exists in the React Native build of the Firebase JS SDK; the
// browser build does not export it. This shim re-exports the real browser build
// (Metro skips the redirect for files inside shims/) and supplies the browser
// equivalent so the shared config code runs unchanged.
import type { Persistence } from "firebase/auth"
import * as firebaseAuth from "firebase/auth"

const browser = firebaseAuth as unknown as { browserLocalPersistence: Persistence }

export * from "firebase/auth"

/**
 * Web equivalent of `getReactNativePersistence`. The AsyncStorage argument is
 * ignored (the browser SDK talks to localStorage/IndexedDB directly).
 *
 * Returning `undefined` here would be *worse* than it looks: `_initializeAuthInstance`
 * turns `deps.persistence || []` into an empty hierarchy, which silently falls
 * back to in-memory persistence and signs the user out on every page reload.
 * `browserLocalPersistence` keeps the session; Firebase still degrades to
 * in-memory when storage is unavailable (private mode, blocked cookies).
 */
export const getReactNativePersistence = (_asyncStorage: unknown): Persistence =>
  browser.browserLocalPersistence
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore"
import type { FirebaseApp } from "firebase/app"

/**
 * Firestore instance for the web.
 *
 * The JavaScript SDK memory-caches by default, so a write made offline would be
 * lost on reload. `persistentLocalCache` stores both the cache and the pending
 * write queue in IndexedDB — shared between tabs — and replays the queue
 * automatically when the connection is back.
 */
export const createFirestore = (app: FirebaseApp): Firestore => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch {
    // Fast Refresh re-evaluates the module after the instance exists.
    return getFirestore(app)
  }
}

import { getFirestore } from "@react-native-firebase/firestore"
import type { FirebaseApp } from "@react-native-firebase/app"

/**
 * Firestore instance for the native platforms.
 *
 * Android and iOS enable persistence by default: every write lands in the
 * on-device cache first (and survives restarts) while the SDK queues it and
 * replays the queue by itself as soon as the connection returns, so there is
 * nothing to configure here.
 */
export const createFirestore = (app: FirebaseApp) => getFirestore(app)

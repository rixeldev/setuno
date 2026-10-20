import { getFunctions, httpsCallable } from "@react-native-firebase/functions"

import {
  collection,
  firestore,
  mapDocs,
  onSnapshot,
  paths,
  type Unsubscribe,
} from "@/db/Fire"
import { mapDeviceSession, sortDevices } from "@/libs/deviceSessions"
import type { DeviceSession } from "@/interfaces"

/**
 * The account's device list (roadmap #69): read back from #52's push
 * registrations at `users/{uid}/devices` — every phone or tablet that ever
 * registered for notifications and has not signed out yet. The subscription
 * is owner-only (the rules pin it), client-sorted through `sortDevices`, and
 * a row the mapper cannot read simply drops out.
 *
 * Firebase exposes **no** full session list — web browser sessions and short-
 * lived ID tokens live only inside Firebase Auth — so this list is the honest
 * slice a client can see, and the screen says so.
 */
export const subscribeMyDevices = (
  uid: string,
  onChange: (devices: DeviceSession[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  if (!uid) return () => undefined
  return onSnapshot(
    collection(firestore, paths.userDevices(uid)),
    (snapshot) =>
      onChange(
        sortDevices(
          mapDocs(snapshot, (data, id) => mapDeviceSession(id, data)).filter(
            (device): device is DeviceSession => device !== null,
          ),
        ),
      ),
    (error) => onError?.(error),
  )
}

/**
 * Ends **every** refresh token for this account, on every device and in every
 * browser — the callable also sweeps the device documents server-side, so the
 * list above empties instead of advertising sessions that are gone. The
 * caller's own session dies with the rest (the revocation is account-wide by
 * nature), which is why the screen signs out locally right after.
 */
export const signOutEverywhere = async (): Promise<void> => {
  const call = httpsCallable<Record<string, never>, { revoked: boolean; devices: number }>(
    getFunctions(),
    "signOutEverywhere",
  )
  await call({})
}

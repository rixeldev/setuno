import { activateKeepAwakeAsync, deactivateKeepAwake, isAvailableAsync } from "expo-keep-awake"

/**
 * Stage-mode screen wake lock (roadmap #2).
 *
 * The native side rides on `expo-keep-awake`. Web never bundles this file:
 * Metro resolves `wakeLock.web.ts` for the browser build (docs §33), which uses
 * the Screen Wake Lock API instead. Both directions are best-effort — a device
 * that cannot hold a wake lock must never stop the reader from working.
 */
const TAG = "setuno-stage-reader"

/** Asks the OS to keep the screen awake. No-op when it cannot. */
export const acquireWakeLock = async (): Promise<void> => {
  try {
    if (!(await isAvailableAsync())) return
    await activateKeepAwakeAsync(TAG)
  } catch {
    // Unsupported device, or the activity is already gone: keep reading.
  }
}

/** Releases the lock taken by {@link acquireWakeLock}. */
export const releaseWakeLock = async (): Promise<void> => {
  try {
    await deactivateKeepAwake(TAG)
  } catch {
    // There was nothing to release.
  }
}

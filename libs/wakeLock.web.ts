/**
 * Web build of the stage-mode screen wake lock (roadmap #2), on top of the
 * Screen Wake Lock API.
 *
 * It needs a secure context and a visible document, and the browser drops the
 * lock whenever the tab is hidden — the reader re-acquires it on return. Where
 * the API is missing or refuses the request, every call is a no-op.
 */
interface WakeLockSentinelLike {
  release: () => Promise<void>
  addEventListener: (type: "release", listener: () => void) => void
}

interface WakeLockLike {
  request: (type: "screen") => Promise<WakeLockSentinelLike>
}

let sentinel: WakeLockSentinelLike | null = null

const wakeLockApi = (): WakeLockLike | null => {
  if (typeof navigator === "undefined") return null
  return (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock ?? null
}

/** Asks the browser to keep the screen awake. No-op when it cannot. */
export const acquireWakeLock = async (): Promise<void> => {
  const api = wakeLockApi()
  if (!api || sentinel) return
  try {
    const lock = await api.request("screen")
    sentinel = lock
    // The browser releases the lock by itself when the tab is hidden: forget it
    // so the next foreground grabs a fresh one.
    lock.addEventListener("release", () => {
      if (sentinel === lock) sentinel = null
    })
  } catch {
    sentinel = null
  }
}

/** Releases the lock taken by {@link acquireWakeLock}. */
export const releaseWakeLock = async (): Promise<void> => {
  const lock = sentinel
  sentinel = null
  if (!lock) return
  try {
    await lock.release()
  } catch {
    // Already released by the browser: nothing left to do.
  }
}

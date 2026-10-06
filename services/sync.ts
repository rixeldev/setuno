import { useSyncExternalStore } from "react"
import NetInfo from "@react-native-community/netinfo"

import {
  firestore,
  onSnapshotsInSync,
  waitForPendingWrites,
} from "@/db/Fire"
import { isOffline } from "@/libs/connectivity"

export type SyncStatus = "offline" | "syncing" | "synced"

export interface SyncState {
  status: SyncStatus
  /** Epoch ms of the last announced sync (null until one happens). */
  lastSyncedAt: number | null
  /** True for a few seconds after a sync finished, to confirm it in the UI. */
  justSynced: boolean
}

/** How long the “everything is up to date” confirmation stays on screen. */
const SYNCED_VISIBLE_MS = 3200

const listeners = new Set<() => void>()
let state: SyncState = { status: "synced", lastSyncedAt: null, justSynced: false }
let hideTimer: ReturnType<typeof setTimeout> | null = null

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getSyncState = (): SyncState => state

/** Live sync status; re-renders on every connectivity or queue change. */
export const useSyncState = (): SyncState =>
  useSyncExternalStore(subscribe, getSyncState, getSyncState)

const setState = (next: Partial<SyncState>): void => {
  const merged = { ...state, ...next }
  if (
    merged.status === state.status &&
    merged.lastSyncedAt === state.lastSyncedAt &&
    merged.justSynced === state.justSynced
  ) {
    return
  }
  state = merged
  listeners.forEach((listener) => listener())
}

const clearHideTimer = (): void => {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = null
}

const showStatus = (status: "offline" | "syncing"): void => {
  clearHideTimer()
  setState({ status, justSynced: false })
}

/** Marks the queue as drained. `announce` shows the confirmation in the UI. */
const showSynced = (announce: boolean): void => {
  clearHideTimer()
  setState({
    status: "synced",
    lastSyncedAt: announce ? Date.now() : state.lastSyncedAt,
    justSynced: announce,
  })
  if (announce) {
    hideTimer = setTimeout(() => setState({ justSynced: false }), SYNCED_VISIBLE_MS)
  }
}

/**
 * Pushes whatever sits in the local write queue and resolves once the server
 * has acknowledged it. `silent` is used on cold start (a queue left over from a
 * previous session) so the banner does not flash for nothing.
 */
const flushPendingWrites = async (options: { silent?: boolean } = {}): Promise<void> => {
  if (!options.silent) showStatus("syncing")
  try {
    // Firestore reconnects on its own; this resolves once the queue drains.
    await waitForPendingWrites(firestore)
    showSynced(!options.silent)
  } catch {
    // Still unreachable: everything stays on the device and the next
    // connectivity change retries.
    if (!options.silent) showStatus("offline")
  }
}

/**
 * Watches connectivity and drains the local write queue.
 *
 * Firestore already saves every write on the device and replays the queue by
 * itself (native persistence by default, IndexedDB on web); this layer keeps
 * the UI honest about it: offline → the banner explains that changes are stored
 * locally, back online → “syncing…” until the queue is empty, then a brief
 * “everything is up to date”.
 *
 * @returns unsubscribe, called when the root layout unmounts.
 */
export const startSyncWatcher = (): (() => void) => {
  let firstEvent = true

  const unsubscribeConnection = NetInfo.addEventListener((connection) => {
    if (firstEvent) {
      firstEvent = false
      if (isOffline(connection)) {
        showStatus("offline")
      } else {
        showSynced(false)
        // Anything left from a previous session drains quietly.
        void flushPendingWrites({ silent: true })
      }
      return
    }

    if (isOffline(connection)) {
      showStatus("offline")
      return
    }
    void flushPendingWrites()
  })

  const unsubscribeSnapshots = onSnapshotsInSync(firestore, () => {
    // Every listener — and therefore the write queue behind them — is in sync.
    if (state.status === "syncing") showSynced(true)
  })

  return () => {
    unsubscribeConnection()
    unsubscribeSnapshots()
    clearHideTimer()
  }
}

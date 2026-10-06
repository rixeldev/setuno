/** Connection helpers shared by the sync layer and the UI. */

export interface ConnectionState {
  isConnected?: boolean | null
  isInternetReachable?: boolean | null
}

/**
 * True only when the device is *sure* to be offline: both flags start as `null`
 * while the OS probes the network, and treating that as offline would flash the
 * banner on every cold start.
 */
export const isOffline = (connection: ConnectionState | null | undefined): boolean =>
  connection?.isConnected === false || connection?.isInternetReachable === false

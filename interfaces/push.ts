/**
 * Push permission states, shared by the native service, the web shim and the
 * app-start question (roadmap #52).
 *
 * The permission itself lives in the OS; the *registration* lives in Firestore
 * (one document per install). The web build reports push as unavailable, so it
 * never asks.
 */

/** What the OS says about notifications on this device. */
export type PushPermissionState = "granted" | "denied" | "undetermined" | "unavailable"

/** The permission plus whether this install is registered to receive pushes. */
export interface PushDeviceState {
  permission: PushPermissionState
  /** This install's device document exists, i.e. push is routed to it. */
  registered: boolean
}

/**
 * The permission, and whether the OS would still show its own dialog.
 *
 * The second half matters on Android 13+: a fresh install reports the
 * permission as **denied** (it was never granted), and the only thing that
 * says the system dialog can still appear is `canAskAgain`. Without it, the
 * app could never ask a member who has not decided yet.
 */
export interface PushPermissionInfo {
  permission: PushPermissionState
  /** True while the OS would still show its own permission dialog. */
  canAskAgain: boolean
}

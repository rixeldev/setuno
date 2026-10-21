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

/**
 * Push registration, web build (roadmap #52). Browsers get no app-level push
 * from Setuno — the settings screen reads this file through Metro's platform
 * resolution and renders its "not on the web" caption instead of the master
 * switch — while the per-account preferences below it stay fully editable and
 * travel to the phone. Keeping the whole surface here is what lets the web
 * bundle never import `expo-notifications`.
 */

/** `"unavailable"` is the only state a browser can report. */
export type PushPermissionState = "granted" | "denied" | "undetermined" | "unavailable"

export interface PushDeviceState {
  permission: PushPermissionState
  registered: boolean
}

export const getPushDeviceState = async (): Promise<PushDeviceState> => ({
  permission: "unavailable",
  registered: false,
})

export const enablePushForThisDevice = async (): Promise<PushDeviceState> => ({
  permission: "unavailable",
  registered: false,
})

export const disablePushForThisDevice = async (): Promise<void> => undefined

export const refreshPushRegistration = async (): Promise<void> => undefined

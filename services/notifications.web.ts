/**
 * Push registration, web build (roadmap #52). Browsers get no app-level push
 * from Setuno — the settings screen reads this file through Metro's platform
 * resolution and renders its "not on the web" caption instead of the master
 * switch — while the per-account preferences below it stay fully editable and
 * travel to the phone. Keeping the whole surface here is what lets the web
 * bundle never import `expo-notifications`.
 */

import type { PushDeviceState, PushPermissionState } from "@/interfaces/push"

export type { PushDeviceState, PushPermissionState }

export const getPushDeviceState = async (): Promise<PushDeviceState> => ({
  permission: "unavailable",
  registered: false,
})

/** A browser has no app-level push: there is never anything to ask. */
export const getPushPermissionState = async (): Promise<PushPermissionState> => "unavailable"

/** The web never asks, so the ledger always answers "already asked". */
export const hasAskedForPush = async (): Promise<boolean> => true

export const rememberPushPrompt = async (): Promise<void> => undefined

export const enablePushForThisDevice = async (): Promise<PushDeviceState> => ({
  permission: "unavailable",
  registered: false,
})

export const disablePushForThisDevice = async (): Promise<void> => undefined

export const refreshPushRegistration = async (): Promise<void> => undefined

/** No push token exists in a browser — there is no row to mark as "this device". */
export const getThisDeviceToken = async (): Promise<string | null> => null

import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"

import { deleteDoc, doc, firestore, getDoc, paths, serverTimestamp, setDoc } from "@/db/Fire"
import type { LanguageCode } from "@/libs/language"

/**
 * Push registration for this install (roadmap #52).
 *
 * One install = one document at `users/{uid}/devices/{expo token}`, and that
 * document *is* the master switch for this device: it exists → pushes are
 * routed here, it is gone → they never come back on their own. This module is
 * the only writer, the silent refresh never creates a document, and there is
 * deliberately **no local "off" flag** — the document's absence is the durable
 * off state, exactly what the settings switch deletes.
 *
 * The minted token doubles as the document id and is cached in AsyncStorage
 * beside it, so the app-start refresh and the screen's own state read never
 * need the network; an empty cache means this install has never registered
 * (every path that learns about a document caches its token).
 *
 * Native only — the web build loads `services/notifications.web.ts`, which
 * reports push as unavailable, so the web bundle never imports
 * `expo-notifications`.
 */

/** `"unavailable"` only ever comes from the web shim. */
export type PushPermissionState = "granted" | "denied" | "undetermined" | "unavailable"

export interface PushDeviceState {
  permission: PushPermissionState
  /** This install's device document exists, i.e. push is routed to it. */
  registered: boolean
}

/** The Expo push token is both the registration and the document id. */
const TOKEN_KEY = "setuno:push-device-token"

/** The channel `app.config.js` declares as the default one. */
const CHANNEL_ID = "default"

// A push that arrives while the reader is open must look exactly like one
// that arrives in the background; without this handler the SDK stays silent
// in the foreground. Set once at module load — importing any function below
// installs it.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

/** `granted` wins outright; otherwise the raw status string settles the rest. */
const permissionOf = (response: { granted: boolean; status: unknown }): PushPermissionState =>
  response.granted
    ? "granted"
    : String(response.status) === "undetermined"
      ? "undetermined"
      : "denied"

/** Android 8+ needs the channel before any message can land on it. */
const ensureAndroidChannel = async (): Promise<void> => {
  if (Platform.OS !== "android") return
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Setuno",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#EA580C",
  }).catch(() => undefined)
}

const readCachedToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/** Cache-first: only a first-ever registration reaches Expo's servers. */
const expoPushToken = async (): Promise<string> => {
  const cached = await readCachedToken()
  if (cached) return cached
  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
  await AsyncStorage.setItem(TOKEN_KEY, token.data).catch(() => undefined)
  return token.data
}

const deviceReference = (uid: string, token: string) =>
  doc(firestore, paths.userDevice(uid, token))

/**
 * What the settings screen opens on: the OS permission state plus whether
 * this install is registered. Never prompts, and an undetermined permission
 * already answers the question (never asked ⇒ never registered), so a fresh
 * install reads without touching the network.
 */
export const getPushDeviceState = async (uid: string): Promise<PushDeviceState> => {
  const permission = permissionOf(await Notifications.getPermissionsAsync())
  if (permission === "undetermined") return { permission, registered: false }
  try {
    const token = await expoPushToken()
    const snapshot = await getDoc(deviceReference(uid, token))
    return { permission, registered: snapshot.exists() }
  } catch {
    // Offline before the first mint: nothing could be routed here anyway.
    return { permission, registered: false }
  }
}

/**
 * The only place that prompts: asks the OS for permission, then creates (or
 * rewrites) this device's document. A denied permission is not an error — it
 * comes back as the state the screen renders with its "open system settings"
 * path — while an unmintable token (offline, first run) throws so the caller
 * can say so.
 */
export const enablePushForThisDevice = async (
  uid: string,
  lang: LanguageCode,
): Promise<PushDeviceState> => {
  const permission = permissionOf(await Notifications.requestPermissionsAsync())
  if (permission !== "granted") return { permission, registered: false }
  await ensureAndroidChannel()
  const token = await expoPushToken()
  await setDoc(deviceReference(uid, token), {
    token,
    platform: Platform.OS,
    lang,
    lastSeenAt: serverTimestamp(),
  })
  return { permission: "granted", registered: true }
}

/** Turns this device off by deleting its document — nothing else remembers. */
export const disablePushForThisDevice = async (uid: string): Promise<void> => {
  const token = await readCachedToken()
  // No cached token ⇒ this install has no registration to remove.
  if (!token) return
  await deleteDoc(deviceReference(uid, token))
}

/**
 * Silent re-registration from `AppShell`: refreshes `lang` and `lastSeenAt`
 * on a document that already exists. It never creates one (a permission
 * granted at the OS level must not resurrect a device the user switched off
 * here) and never prompts — an undetermined permission is left for the
 * settings screen to ask about.
 */
export const refreshPushRegistration = async (
  uid: string,
  lang: LanguageCode,
): Promise<void> => {
  const permission = permissionOf(await Notifications.getPermissionsAsync())
  if (permission !== "granted") return
  const token = await readCachedToken()
  if (!token) return // never registered on this install: absence is "off"
  await ensureAndroidChannel()
  const reference = deviceReference(uid, token)
  const snapshot = await getDoc(reference)
  if (!snapshot.exists()) return // switched off (or pruned): stay off
  await setDoc(
    reference,
    { token, platform: Platform.OS, lang, lastSeenAt: serverTimestamp() },
    { merge: true },
  )
}

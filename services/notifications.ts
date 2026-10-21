import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"

import { deleteDoc, doc, firestore, getDoc, paths, serverTimestamp, setDoc } from "@/db/Fire"
import type { LanguageCode } from "@/libs/language"
import type { PushDeviceState, PushPermissionInfo, PushPermissionState } from "@/interfaces/push"

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
 * The app-start question (see `hooks/usePushPrompt.ts`) needs one more thing:
 * whether this install was **already asked**. That answer is remembered on the
 * device, because the permission lives in the OS and the registration in
 * Firestore — a member who said no is not asked again on every start, and the
 * settings screen is always there to change it.
 *
 * Native only — the web build loads `services/notifications.web.ts`, which
 * reports push as unavailable, so the web bundle never imports
 * `expo-notifications`.
 */

export type { PushDeviceState, PushPermissionInfo, PushPermissionState }

/** The Expo push token is both the registration and the document id. */
const TOKEN_KEY = "setuno:push-device-token"

/** Whether this install has already been asked about notifications. */
const ASKED_KEY = "setuno:push-asked:v2"

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
 * The OS permission, and nothing else: no token, no network, no document.
 *
 * The app-start question needs to know whether asking is still worth it, and
 * the settings screen needs the full state (with the document) — so the two
 * are separate reads.
 *
 * `canAskAgain` is the half that matters: on Android 13+ a fresh install
 * reports the permission as **denied** (it was never granted), so the status
 * alone cannot tell "not decided yet" from "blocked for good".
 */
export const getPushPermissionInfo = async (): Promise<PushPermissionInfo> => {
  const response = await Notifications.getPermissionsAsync()
  return {
    permission: permissionOf(response),
    canAskAgain: response.canAskAgain !== false,
  }
}

/**
 * Whether this install has already been asked.
 *
 * The ledger is written **only when the member answers** — never because the
 * permission happened to be settled — so a device that was never asked can
 * still be asked later.
 *
 * A ledger that cannot be read answers "yes" (do not ask): a member who said
 * no must not be nagged on every start, and the settings screen is always
 * there to change it.
 */
export const hasAskedForPush = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(ASKED_KEY)) === "1"
  } catch {
    return true
  }
}

/** Remembers that the question was answered on this install. */
export const rememberPushPrompt = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(ASKED_KEY, "1")
  } catch {
    // A ledger that cannot be written only means the question may come back.
  }
}

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
 * The document id this install would own (roadmap #69): the cached push
 * token, read without the network, so the devices screen can mark its own row
 * — `null` while this install has never registered (never asked, switched
 * off, or web).
 */
export const getThisDeviceToken = async (): Promise<string | null> => readCachedToken()

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

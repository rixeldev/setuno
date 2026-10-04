import {
  doc,
  firestore,
  getDoc,
  mapDoc,
  normalizeEmail,
  onSnapshot,
  paths,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "@/db/Fire"
import {
  DEFAULT_PREFERENCES,
  type UserPreferences,
  type UserProfile,
  type UserProfileUpdate,
} from "@/interfaces"
import { applyAccent, applyAppearanceMode, applyAppearance } from "@/services/themeManager"
import { updateCachedPreferences, writeCachedPreferences } from "@/services/prefs"
import { isAccentId, isAppearanceMode } from "@/libs/appearance"

const mapUser = (data: Record<string, unknown>, id: string): UserProfile =>
  ({
    uid: id,
    displayName: String(data.displayName ?? ""),
    email: String(data.email ?? ""),
    photoURL: (data.photoURL as string | null) ?? null,
    organizationIds: Array.isArray(data.organizationIds)
      ? (data.organizationIds as string[])
      : [],
    activeOrganizationId: (data.activeOrganizationId as string | null) ?? null,
    preferences: { ...DEFAULT_PREFERENCES, ...((data.preferences as Partial<UserPreferences>) ?? {}) },
    onboarded: Boolean(data.onboarded),
    createdAt: data.createdAt as UserProfile["createdAt"],
    updatedAt: data.updatedAt as UserProfile["updatedAt"],
  }) as UserProfile



export interface EnsureProfileInput {
  uid: string
  email: string
  displayName: string
  photoURL?: string | null
}

/**
 * Creates the profile document on first sign-in and backfills missing fields
 * (e.g. after the user sets a display name in Firebase Auth).
 */
export const ensureUserProfile = async (input: EnsureProfileInput): Promise<UserProfile> => {
  const reference = doc(firestore, paths.user(input.uid))
  const snapshot = await getDoc(reference)
  const now = serverTimestamp()

  if (!snapshot.exists()) {
    const payload = {
      displayName: input.displayName,
      email: normalizeEmail(input.email),
      photoURL: input.photoURL ?? null,
      organizationIds: [],
      activeOrganizationId: null,
      preferences: DEFAULT_PREFERENCES,
      onboarded: false,
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(reference, payload)
    return mapUser({ ...payload, createdAt: now, updatedAt: now }, input.uid)
  }

  const data = snapshot.data() as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  // Keep the profile in sync with Firebase Auth without overwriting edits.
  if (data.displayName !== input.displayName && input.displayName.length > 0) {
    patch.displayName = input.displayName
  }
  if (data.email !== normalizeEmail(input.email) && input.email.length > 0) {
    patch.email = normalizeEmail(input.email)
  }
  if (input.photoURL && data.photoURL !== input.photoURL) {
    patch.photoURL = input.photoURL
  }
  if (Object.keys(patch).length > 0) {
    patch.updatedAt = now
    await updateDoc(reference, patch)
  }

  return mapUser({ ...data, ...patch }, input.uid)
}

export const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snapshot = await getDoc(doc(firestore, paths.user(uid)))
  return mapDoc(snapshot, mapUser)
}

/** Live profile updates (preferences, name, active organization...). */
export const subscribeUserProfile = (
  uid: string | null,
  onChange: (profile: UserProfile | null) => void,
): Unsubscribe => {
  if (!uid) {
    onChange(null)
    return () => undefined
  }
  return onSnapshot(
    doc(firestore, paths.user(uid)),
    (snapshot) => {
      const profile = mapDoc(snapshot, mapUser)
      // Keep the local preference cache in step with the profile so settings
      // survive a restart even when this device is offline next time.
      if (profile) writeCachedPreferences(profile.preferences)
      onChange(profile)
    },
    () => onChange(null),
  )
}

/** Pushes appearance preferences to the runtime palette engine as well. */
const applyPreferencesToRuntime = (preferences: UserPreferences): void => {
  const accent = isAccentId(preferences.accent) ? preferences.accent : undefined
  const mode = isAppearanceMode(preferences.appearance) ? preferences.appearance : undefined
  applyAppearance({ accent, mode })
}

export const updateUserProfile = async (
  uid: string,
  update: UserProfileUpdate,
): Promise<void> => {
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() }
  if (update.displayName !== undefined) patch.displayName = update.displayName.trim()
  if (update.photoURL !== undefined) patch.photoURL = update.photoURL
  if (update.onboarded !== undefined) patch.onboarded = update.onboarded
  if (update.activeOrganizationId !== undefined) patch.activeOrganizationId = update.activeOrganizationId
  if (update.preferences) {
    const current = await fetchUserProfile(uid)
    const merged = { ...(current?.preferences ?? DEFAULT_PREFERENCES), ...update.preferences }
    patch.preferences = merged
    updateCachedPreferences(merged)
    applyPreferencesToRuntime(merged)
  }
  await updateDoc(doc(firestore, paths.user(uid)), patch)
}

/** Fast preference write used by the appearance screen (no profile read). */
export const updatePreferences = async (
  uid: string,
  preferences: Partial<UserPreferences>,
): Promise<void> => {
  const reference = doc(firestore, paths.user(uid))
  const snapshot = await getDoc(reference)
  const stored = snapshot.data() as { preferences?: Partial<UserPreferences> } | undefined
  const current: UserPreferences = {
    ...DEFAULT_PREFERENCES,
    ...(stored?.preferences ?? {}),
  }
  const merged = { ...current, ...preferences }
  updateCachedPreferences(merged)
  applyPreferencesToRuntime(merged)
  await updateDoc(reference, {
    preferences: merged,
    updatedAt: serverTimestamp(),
  })
}

export const setAccentPreference = (accent: Parameters<typeof applyAccent>[0]): void => {
  applyAccent(accent)
}

export const setAppearanceMode = (mode: Parameters<typeof applyAppearanceMode>[0]): void => {
  applyAppearanceMode(mode)
}

/**
 * Note: there is no "find a user by email" helper on purpose. Member invites go
 * through the email-keyed invitation documents, so a client never needs read
 * access to another person's profile and user documents stay private to their
 * owner (docs §23).
 */
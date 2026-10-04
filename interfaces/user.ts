import type { MaybeTimestamp, TimestampLike } from "./timestamp"

export type AppearanceMode = "dark" | "light"
export type AccentId = "teal" | "amber" | "indigo" | "crimson" | "emerald" | "violet"

/** Song reader defaults + display preferences stored on the user profile. */
export interface UserPreferences {
  appearance: AppearanceMode
  accent: AccentId
  /** Base font size for the song reader. */
  songFontSize: number
  /** Show chords by default when opening a song. */
  chordsVisible: boolean
  /** Reduce motion / subtle animation preference. */
  reduceMotion: boolean
}

/** Minimal, shareable profile written to `users/{uid}`. */
export interface UserProfile {
  uid: string
  displayName: string
  email: string
  photoURL: string | null
  /** Organizations the user is a member of (denormalised for fast switching). */
  organizationIds: string[]
  /** Currently selected organization. */
  activeOrganizationId: string | null
  preferences: UserPreferences
  onboarded: boolean
  createdAt: TimestampLike
  updatedAt: TimestampLike
}

/** Patch shape accepted by the profile service. */
export interface UserProfileUpdate {
  displayName?: string
  photoURL?: string | null
  preferences?: Partial<UserPreferences>
  onboarded?: boolean
  activeOrganizationId?: string | null
}

/** Lightweight public projection used in member lists and suggestion authors. */
export interface UserSummary {
  uid: string
  displayName: string
  email: string
  photoURL: string | null
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  appearance: "dark",
  accent: "teal",
  songFontSize: 18,
  chordsVisible: true,
  reduceMotion: false,
}

export type MaybeUserProfile = UserProfile | null
export type MaybeUserTimestamp = MaybeTimestamp
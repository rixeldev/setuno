import type { MaybeTimestamp, TimestampLike } from "./timestamp"

/** "system" follows the device/browser colour scheme. */
export type AppearanceMode = "dark" | "light" | "system"
export type AccentId = "ember" | "ocean" | "emerald" | "sunset" | "magenta" | "indigo"
/** How chords are spelled: american letters (C D E) or solfège (Do Re Mi). */
export type ChordNotation = "letters" | "solfege"

/** Song reader defaults + display preferences stored on the user profile. */
export interface UserPreferences {
  appearance: AppearanceMode
  accent: AccentId
  /** Base font size for the song reader. */
  songFontSize: number
  /** Show chords by default when opening a song. */
  chordsVisible: boolean
  /** Spell chords with letters (C, F#m) or solfège (Do, Fa#m). */
  chordNotation: ChordNotation
  /** Reduce motion / subtle animation preference. */
  reduceMotion: boolean
  /**
   * Internal one-shot flag: the sample song was published for this account.
   * It lives on the profile (not on the song) so deleting the sample never
   * brings it back, even after a re-install or on another device.
   */
  demoSongSeeded?: boolean
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
  /** When the username was last changed (null: never). One change per 3 months. */
  usernameChangedAt: TimestampLike | null
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
  accent: "ember",
  songFontSize: 18,
  chordsVisible: true,
  chordNotation: "letters",
  reduceMotion: false,
}

export type MaybeUserProfile = UserProfile | null
export type MaybeUserTimestamp = MaybeTimestamp
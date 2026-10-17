import type { PushNotificationType } from "@/functions/src/notify"

import type { MaybeTimestamp, TimestampLike } from "./timestamp"

/** "system" follows the device/browser colour scheme. */
export type AppearanceMode = "dark" | "light" | "system"
export type AccentId = "ember" | "ocean" | "emerald" | "sunset" | "magenta" | "indigo"
/**
 * How chords are spelled: american letters (C D E), solfège (Do Re Mi) or
 * Nashville numbers (1 4 5). Notes are always *stored* in letters.
 */
export type ChordNotation = "letters" | "solfege" | "nashville"
/** Instrument the reader shows shapes for when a chord is tapped. */
/**
 * The reader's "how to play" sheet. Guitar and ukulele come from the bundled
 * `chords-db` dataset, bass is derived from the chord spelling (roadmap #24),
 * piano is derived too.
 */
export type ChordInstrument = "guitar" | "ukulele" | "bass" | "piano"
/** Reader layout: chords above the lyrics, lyrics only, or a chord chart. */
export type ChordView = "both" | "lyrics" | "chords"

/** Song reader defaults + display preferences stored on the user profile. */
export interface UserPreferences {
  appearance: AppearanceMode
  accent: AccentId
  /** Base font size for the song reader. */
  songFontSize: number
  /** Reader layout opened by default: both, lyrics only or chords only. */
  chordView: ChordView
  /** Spell chords with letters (C, F#m), solfège (Do, Fa#m) or numbers (1, 4, 5). */
  chordNotation: ChordNotation
  /** Preferred instrument for the “how to play” chord sheet. */
  chordInstrument: ChordInstrument
  /** Reduce motion / subtle animation preference. */
  reduceMotion: boolean
  /** Keep the screen awake while the reader is in stage mode. */
  keepAwake: boolean
  /**
   * Pinned voicing per chord and instrument (`${instrument}:${chord}` →
   * voicing id), chosen from the “how to play” sheet (roadmap #23). It lives on
   * the profile, never on the song, so it follows the user everywhere.
   */
  voicings?: Record<string, string>
  /**
   * Internal one-shot flag: the sample song was published for this account.
   * It lives on the profile (not on the song) so deleting the sample never
   * brings it back, even after a re-install or on another device.
   */
  demoSongSeeded?: boolean
  /**
   * Per-type push opt-outs (roadmap #52). Opt-out model: an absent map — or a
   * type missing from it — means *enabled*, so every profile created before
   * #52 keeps receiving everything with no migration, exactly the contract
   * `functions/src/notify.ts#pushTypeEnabled` applies on every send. The
   * notifications screen always writes the whole `PUSH_NOTIFICATION_TYPES`
   * map.
   */
  notifications?: Partial<Record<PushNotificationType, boolean>>
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
  chordView: "both",
  chordNotation: "letters",
  chordInstrument: "guitar",
  reduceMotion: false,
  keepAwake: true,
}

export type MaybeUserProfile = UserProfile | null
export type MaybeUserTimestamp = MaybeTimestamp
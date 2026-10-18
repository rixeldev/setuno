/**
 * The observability funnel (roadmap #73): one taxonomy in one place, so a name
 * can never drift between the screen that fires an event and the console that
 * reads it. Collection itself is consent-gated in `services/telemetry.ts`
 * (platform-split); this module stays pure and platform-free apart from the
 * sign-up handshake below (module state in a lib has its precedent in
 * `libs/commandPalette.ts`).
 */

/** The core activation funnel. Firebase rule: `^[a-z][a-z0-9_]{0,39}$`. */
export const FUNNEL_EVENTS = {
  signUpCompleted: "sign_up_completed",
  firstSongCreated: "first_song_created",
  firstSetlist: "first_setlist",
  firstPerformance: "first_performance",
  readerOpened: "reader_opened",
  stageModeEnabled: "stage_mode_enabled",
  chordSheetOpened: "chord_sheet_opened",
  suggestionCreated: "suggestion_created",
  suggestionResolved: "suggestion_resolved",
} as const

export type FunnelEvent = (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS]

export const FUNNEL_EVENT_NAMES: readonly FunnelEvent[] = Object.values(FUNNEL_EVENTS)

/** Event parameter payload: strings and numbers only (Firebase's rule). */
export type FunnelParams = Record<string, string | number>

/**
 * The names Firebase Analytics logs on its own (docs "Reserved event names"):
 * a taxonomy entry colliding with one of these would never reach the reports.
 */
const RESERVED_EVENTS: ReadonlySet<string> = new Set([
  "ad_activeview",
  "ad_click",
  "ad_exposure",
  "ad_impression",
  "ad_query",
  "ad_reward",
  "app_clear_data",
  "app_exception",
  "app_remove",
  "app_update",
  "error",
  "first_open",
  "first_visit",
  "in_app_purchase",
  "notification_dismiss",
  "notification_foreground",
  "notification_open",
  "notification_receive",
  "os_update",
  "session_start",
  "user_engagement",
])

/**
 * True when a name Firebase would actually accept: the documented event-name
 * shape, never one of the names the SDK emits by itself.
 */
export const isValidFunnelEvent = (name: string): boolean =>
  /^[a-z][a-z0-9_]{0,39}$/.test(name) && !RESERVED_EVENTS.has(name)

/**
 * A "first …" milestone fires only on the band's 0 → 1 transition: the count
 * is what the screen had in memory *before* the write being celebrated.
 */
export const firstFunnelEvent = (countBefore: number, event: FunnelEvent): FunnelEvent | null =>
  countBefore === 0 ? event : null

/**
 * The sign-up screen's consent answer, waiting to be stamped into the profile
 * that `ensureUserProfile` is about to create — the profile write races the
 * screen's own navigation, so the choice travels through this slot instead of
 * a function argument. `take` consumes it: one account, one answer.
 */
let pendingSignupConsent: boolean | null = null

export const setPendingSignupConsent = (accepted: boolean): void => {
  pendingSignupConsent = accepted
}

export const takePendingSignupConsent = (): boolean | null => {
  const taken = pendingSignupConsent
  pendingSignupConsent = null
  return taken
}

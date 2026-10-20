/**
 * A registered device (roadmap #69): one row of `users/{uid}/devices` — the
 * push-registration documents #52 already writes, read back as the account's
 * device list. `token` is the document id (the Expo push token, never
 * displayed), `platform` the OS the rules pin to android/ios with an
 * `unknown` fallback for anything older, and `lastSeenAt` the registration's
 * last silent refresh (an unreadable stamp reads as `null`, the row still
 * renders — a security list must not hide what it cannot parse).
 */
export interface DeviceSession {
  token: string
  platform: "android" | "ios" | "unknown"
  lastSeenAt: Date | null
}

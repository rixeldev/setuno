import AsyncStorage from "@react-native-async-storage/async-storage"

import {
  PENDING_JOIN_KEY,
  pendingJoinFromJson,
  sanitizePendingJoin,
  type PendingJoin,
} from "@/libs/pendingJoin"

/**
 * The invitation link a signed-out visitor arrived with (roadmap #89), parked
 * on the device until there is an account to redeem it with. Display-preference
 * class data — local only, no rules, no Firestore, nothing to deploy.
 */

/** Remember a link so the sign-in/sign-up that follows can finish the job. */
export const savePendingJoin = async (token: string, nowMs: number = Date.now()): Promise<void> => {
  const entry = sanitizePendingJoin({ token, savedAt: nowMs }, nowMs)
  if (!entry) return
  try {
    await AsyncStorage.setItem(PENDING_JOIN_KEY, JSON.stringify(entry))
  } catch {
    // A missing slot only costs the visitor a second tap; it must not throw on
    // the way to sign-in.
  }
}

/** The parked link, if it is still worth redeeming. */
export const readPendingJoin = async (nowMs: number = Date.now()): Promise<PendingJoin | null> => {
  try {
    return pendingJoinFromJson(await AsyncStorage.getItem(PENDING_JOIN_KEY), nowMs)
  } catch {
    return null
  }
}

/** Forget it — after a redemption attempt, successful or not: one try per tap. */
export const clearPendingJoin = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PENDING_JOIN_KEY)
  } catch {
    // Nothing to do: a stale entry expires on its own (30-day window).
  }
}

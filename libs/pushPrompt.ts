import type { PushPermissionInfo } from "@/interfaces/push"

/**
 * The app-start question about notifications (roadmap #52).
 *
 * The app asks once, at the start, whether the member wants push
 * notifications — a question the settings screen alone used to leave to the
 * member to find. The rules:
 *
 * - **Only while the OS would still ask.** On Android 13+ a fresh install
 *   reports the permission as *denied* (it was never granted), so the status
 *   cannot tell "not decided yet" from "blocked for good" — `canAskAgain`
 *   can, and it is the half that decides.
 * - **Only once per install.** The answer is remembered on the device, so a
 *   member who says no is not asked again on every start. The settings screen
 *   is always there to turn it on.
 */

/** Whether the app-start question is still worth asking. */
export const shouldAskForPush = (asked: boolean, info: PushPermissionInfo): boolean => {
  if (asked) return false
  if (info.permission === "granted") return false
  if (info.permission === "unavailable") return false
  return info.canAskAgain
}

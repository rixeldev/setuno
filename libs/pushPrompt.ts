import type { PushPermissionState } from "@/interfaces/push"

/**
 * The app-start question about notifications (roadmap #52).
 *
 * The app asks once, at the start, whether the member wants push
 * notifications — a question the settings screen alone used to leave to the
 * member to find. The rules:
 *
 * - **Only when the OS would still ask.** An undetermined permission is the
 *   only state where the system dialog can still appear; a denied one is
 *   settled (the settings screen shows the "open system settings" path) and a
 *   granted one needs no question.
 * - **Only once per install.** The answer is remembered on the device, so a
 *   member who says no is not asked again on every start. The settings screen
 *   is always there to turn it on.
 */

/** Whether the app-start question is still worth asking. */
export const shouldAskForPush = (
  asked: boolean,
  permission: PushPermissionState,
): boolean => !asked && permission === "undetermined"

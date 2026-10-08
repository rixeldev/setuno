import { Platform } from "react-native"
import * as Haptics from "expo-haptics"

/**
 * Fire-and-forget haptic feedback.
 *
 * Unsupported devices, simulators and browsers without the Vibration API
 * reject the promise; feedback is a nicety, so failures are deliberately
 * swallowed and callers never need to check anything.
 *
 * Tuning notes: on Android expo-haptics plays its own wave forms and `Light`,
 * `Soft` and `selectionAsync` all last the same 50 ms — that is why ordinary
 * presses used to feel identical. `performAndroidHapticsAsync` asks the OS for
 * its own effects instead, which are shorter, softer and respect the device's
 * haptics setting. On iOS the duration belongs to the system; `selectionAsync`
 * is the lightest feedback available. On the web the pattern is a plain
 * `navigator.vibrate` duration.
 */
const run = (feedback: () => Promise<void>): void => {
  void feedback().catch(() => undefined)
}

/**
 * Very short tick for ordinary presses (buttons, rows). Swap the Android
 * constant for another system effect to taste: `Virtual_Key`,
 * `Keyboard_Tap`, `Segment_Frequent_Tick`, `Clock_Tick`…
 */
export const hapticTap = (): void => {
  if (Platform.OS === "android") {
    run(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key))
    return
  }
  run(() => Haptics.selectionAsync())
}

/** Soft tick for selection changes (tab switches, pickers). */
export const hapticSelection = (): void => {
  if (Platform.OS === "android") {
    run(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick))
    return
  }
  run(() => Haptics.selectionAsync())
}

/** Confirmation for a finished action (saved, sent, deleted). */
export const hapticSuccess = (): void => {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
}

/** Warning buzz for failures (failed saves, denied operations). */
export const hapticError = (): void => {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))
}

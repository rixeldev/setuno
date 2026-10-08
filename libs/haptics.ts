import * as Haptics from "expo-haptics"

/**
 * Fire-and-forget haptic feedback.
 *
 * Unsupported devices, simulators and browsers without the Vibration API
 * reject the promise; feedback is a nicety, so failures are deliberately
 * swallowed and callers never need to check anything.
 */
const run = (feedback: () => Promise<void>): void => {
  void feedback().catch(() => undefined)
}

/** Subtle tap for buttons and other direct actions. */
export const hapticTap = (): void => {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
}

/** Soft tick for selection changes (tabs, pickers). */
export const hapticSelection = (): void => {
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
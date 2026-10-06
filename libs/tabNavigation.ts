/**
 * Pure helpers for the bottom-bar transitions (unit-tested).
 *
 * The shell keeps a single stack whose anchor is the dashboard, so moving
 * between tabs is a push/pop instead of a real tab navigator. These helpers
 * decide which way the target screen should slide in.
 */

export type TabDirection = "left" | "right"

/**
 * Direction of a tab change: moving to a tab on the right slides in from the
 * right (right-to-left motion) and moving to one on the left slides in from
 * the left. A non-tab origin (`-1`) defaults to the rightward slide.
 */
export const tabDirection = (currentIndex: number, targetIndex: number): TabDirection =>
  currentIndex === -1 || targetIndex >= currentIndex ? "right" : "left"

/** Native-stack animation matching a tab direction. */
export const tabAnimation = (
  direction: TabDirection,
): "slide_from_right" | "slide_from_left" =>
  direction === "left" ? "slide_from_left" : "slide_from_right"

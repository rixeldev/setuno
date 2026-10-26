/** Minimum short-side (dp) that counts as a tablet (Android's sw600dp). */
export const TABLET_MIN_SHORT_SIDE = 600

/**
 * True when the viewport is a tablet-sized screen. The check is
 * rotation-independent (it looks at the short side), so a tablet never flips
 * back and forth between "tablet" and "phone" while rotating.
 */
export const isTabletViewport = (width: number, height: number): boolean =>
  Number.isFinite(width) &&
  Number.isFinite(height) &&
  Math.min(width, height) >= TABLET_MIN_SHORT_SIDE
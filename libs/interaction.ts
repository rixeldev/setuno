/**
 * Interaction states for `Pressable` (polish pass).
 *
 * React Native's `Pressable` reports `pressed` everywhere, while the web
 * implementation also reports `hovered` and `focused`. Those two are not in the
 * React Native types, so they are read here once — with a real type, no `any` —
 * instead of casting inside every component. On native they simply stay
 * `false`, which is exactly the behaviour those platforms want (hover does not
 * exist there, and the keyboard focus ring is a browser concern).
 */
export interface WebInteractionState {
  pressed: boolean
  hovered: boolean
  focused: boolean
}

export const webInteractionState = (state: unknown): WebInteractionState => {
  const value = (state ?? {}) as { pressed?: unknown; hovered?: unknown; focused?: unknown }
  return {
    pressed: value.pressed === true,
    hovered: value.hovered === true,
    focused: value.focused === true,
  }
}

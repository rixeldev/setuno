/**
 * The command palette is a keyboard affordance (roadmap #29): Ctrl/Cmd+K only
 * means something with a physical keyboard, so the whole feature lives in
 * `components/app/CommandPaletteHost.web.tsx` and Metro picks it for
 * `platform=web`. This native build renders nothing — a phone reaches the same
 * destinations through the tabs and the "More" sheet.
 */
export function CommandPaletteHost(): null {
  return null
}

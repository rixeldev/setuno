import type { AccentId, AppearanceMode } from "@/interfaces/user"

export interface AccentPalette {
  id: AccentId
  name: string
  /** Brand colour used for primary actions. */
  primary: string
  primaryStrong: string
  /** Colour drawn on top of `primary` (dark mode; light mode always uses white). */
  onPrimary: string
  /** Secondary highlight (chords, key badges) paired with the primary. */
  accent: string
}

/**
 * Setuno accents. Every palette is tuned for the two modes:
 * bright and luminous on the dark stage surfaces, and darkened by the palette
 * engine (`services/themeManager.ts`) when light mode renders it on white.
 * The `accent` of each entry is picked to contrast with its `primary`.
 */
export const ACCENTS: Record<AccentId, AccentPalette> = {
  ember: {
    id: "ember",
    name: "Ember Orange",
    primary: "#EA580C",
    primaryStrong: "#C2410C",
    onPrimary: "#2B1003",
    accent: "#2DD4BF",
  },
  ocean: {
    id: "ocean",
    name: "Stage Ocean",
    primary: "#38BDF8",
    primaryStrong: "#0284C7",
    onPrimary: "#06263C",
    accent: "#FBBF24",
  },
  emerald: {
    id: "emerald",
    name: "Encore Emerald",
    primary: "#34D399",
    primaryStrong: "#059669",
    onPrimary: "#032A1E",
    accent: "#F472B6",
  },
  sunset: {
    id: "sunset",
    name: "Sunset Coral",
    primary: "#FB7185",
    primaryStrong: "#E11D48",
    onPrimary: "#330812",
    accent: "#FBBF24",
  },
  magenta: {
    id: "magenta",
    name: "Neon Magenta",
    primary: "#E879F9",
    primaryStrong: "#C026D3",
    onPrimary: "#310A35",
    accent: "#22D3EE",
  },
  indigo: {
    id: "indigo",
    name: "Midnight Indigo",
    primary: "#818CF8",
    primaryStrong: "#4F46E5",
    onPrimary: "#12143F",
    accent: "#34D399",
  },
}

export const ACCENT_LIST: AccentPalette[] = Object.values(ACCENTS)

export const DEFAULT_ACCENT: AccentId = "ember"

export const isAccentId = (value: string): value is AccentId => value in ACCENTS

export const getAccent = (id: string | null | undefined): AccentPalette =>
  (id && isAccentId(id) ? ACCENTS[id] : ACCENTS[DEFAULT_ACCENT]) as AccentPalette

export const APPEARANCE_MODES: AppearanceMode[] = ["dark", "light", "system"]

export const isAppearanceMode = (value: string): value is AppearanceMode =>
  value === "dark" || value === "light" || value === "system"

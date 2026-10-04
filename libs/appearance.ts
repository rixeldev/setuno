import type { AccentId, AppearanceMode } from "@/interfaces/user"

export interface AccentPalette {
  id: AccentId
  name: string
  /** Brand colour used for primary actions. */
  primary: string
  primaryStrong: string
  /** Colour drawn on top of `primary`. */
  onPrimary: string
  /** Tinted fill used behind primary-coloured elements. */
  primarySoft: string
  /** Secondary highlight (chords, key badges). */
  accent: string
  accentSoft: string
}

/**
 * Stage Book accents. Each one is a musical/stage inspired hue that keeps a
 * comfortable contrast ratio against both the dark and light surfaces.
 */
export const ACCENTS: Record<AccentId, AccentPalette> = {
  teal: {
    id: "teal",
    name: "Teal Stage",
    primary: "#14B8A6",
    primaryStrong: "#0D9488",
    onPrimary: "#04201E",
    primarySoft: "#14B8A61F",
    accent: "#F5A524",
    accentSoft: "#F5A5241F",
  },
  amber: {
    id: "amber",
    name: "Warm Amber",
    primary: "#F59E0B",
    primaryStrong: "#D97706",
    onPrimary: "#2A1A03",
    primarySoft: "#F59E0B1F",
    accent: "#38BDF8",
    accentSoft: "#38BDF81F",
  },
  indigo: {
    id: "indigo",
    name: "Indigo Night",
    primary: "#818CF8",
    primaryStrong: "#6366F1",
    onPrimary: "#12123A",
    primarySoft: "#818CF81F",
    accent: "#F472B6",
    accentSoft: "#F472B61F",
  },
  emerald: {
    id: "emerald",
    name: "Emerald Room",
    primary: "#34D399",
    primaryStrong: "#059669",
    onPrimary: "#032018",
    primarySoft: "#34D3991F",
    accent: "#FBBF24",
    accentSoft: "#FBBF241F",
  },
  crimson: {
    id: "crimson",
    name: "Crimson Hall",
    primary: "#FB7185",
    primaryStrong: "#E11D48",
    onPrimary: "#2B0710",
    primarySoft: "#FB71851F",
    accent: "#38BDF8",
    accentSoft: "#38BDF81F",
  },
  violet: {
    id: "violet",
    name: "Violet Reverb",
    primary: "#C084FC",
    primaryStrong: "#9333EA",
    onPrimary: "#23093B",
    primarySoft: "#C084FC1F",
    accent: "#4ADE80",
    accentSoft: "#4ADE801F",
  },
}

export const ACCENT_LIST: AccentPalette[] = Object.values(ACCENTS)

export const DEFAULT_ACCENT: AccentId = "teal"

export const isAccentId = (value: string): value is AccentId => value in ACCENTS

export const getAccent = (id: string | null | undefined): AccentPalette =>
  (id && isAccentId(id) ? ACCENTS[id] : ACCENTS[DEFAULT_ACCENT]) as AccentPalette

export const APPEARANCE_MODES: AppearanceMode[] = ["dark", "light"]

export const isAppearanceMode = (value: string): value is AppearanceMode =>
  value === "dark" || value === "light"
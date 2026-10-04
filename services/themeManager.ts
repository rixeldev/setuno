import { useSyncExternalStore } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Theme, colorWithOpacity, type ThemeColorKey } from "@/constants/Theme"
import {
  DEFAULT_ACCENT,
  getAccent,
  isAppearanceMode,
  type AccentPalette,
} from "@/libs/appearance"
import type { AccentId, AppearanceMode } from "@/interfaces/user"

type Listener = () => void

export interface Appearance {
  mode: AppearanceMode
  accent: AccentId
}

const STORAGE_KEY = "stage-book:appearance:v1"

const listeners = new Set<Listener>()
let appearance: Appearance = { mode: "dark", accent: DEFAULT_ACCENT }
let snapshot = 0

const DARK_BASE = "#0A0C10"
const LIGHT_BASE = "#F7F8FA"

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "").padEnd(6, "0").slice(0, 6)
  const value = parseInt(clean, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

const rgbToHex = (rgb: [number, number, number]): string =>
  `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`

const mix = (a: string, b: string, amount: number): string => {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return rgbToHex([
    ca[0] + (cb[0] - ca[0]) * amount,
    ca[1] + (cb[1] - ca[1]) * amount,
    ca[2] + (cb[2] - ca[2]) * amount,
  ])
}

const setColor = (key: ThemeColorKey, value: string): void => {
  ;(Theme.colors as Record<ThemeColorKey, string>)[key] = value
}

const setGradient = (key: keyof typeof Theme.gradients, value: readonly string[]): void => {
  ;(Theme.gradients as unknown as Record<string, readonly string[]>)[key] = value
}

/**
 * Derives the full colour token set for a given accent + appearance mode.
 * Dark surfaces are tinted towards the accent, light surfaces towards white so
 * the product keeps the same identity in both modes.
 */
const buildPalette = (accent: AccentPalette, mode: AppearanceMode): void => {
  const dark = mode === "dark"

  const background = dark ? mix(accent.primary, DARK_BASE, 0.05) : mix(accent.primary, LIGHT_BASE, 0.03)
  const surface = dark ? mix(accent.primary, "#131720", 0.06) : "#FFFFFF"
  const surfaceHigh = dark ? mix(accent.primary, "#1B212C", 0.08) : mix(accent.primary, "#FFFFFF", 0.0)
  const border = dark ? mix(accent.primary, "#232B38", 0.22) : mix(accent.primary, "#DCE3EC", 0.18)
  const chrome = dark ? mix(accent.primary, "#0D1017", 0.05) : "#FFFFFF"

  setColor("background", background)
  setColor("background2", dark ? mix(background, surface, 0.55) : mix(background, surface, 0.75))
  setColor("text", dark ? "#F5F7FA" : "#101725")
  setColor("textMuted", dark ? "#9AA4B2" : "#55606E")
  setColor("textFaint", dark ? "#6B7480" : "#8590A0")
  setColor("primary", accent.primary)
  setColor("primaryStrong", accent.primaryStrong)
  setColor("primarySoft", accent.primarySoft)
  setColor("onPrimary", accent.onPrimary)
  setColor("accent", accent.accent)
  setColor("accentSoft", accent.accentSoft)
  setColor("surface", surface)
  setColor("surfaceHigh", surfaceHigh)
  setColor("surfaceMuted", dark ? mix(accent.primary, "#202734", 0.08) : mix(accent.primary, "#EDF1F7", 0.12))
  setColor("border", border)
  setColor("borderSoft", dark ? colorWithOpacity("#FFFFFF", 0.08) : colorWithOpacity("#0B1220", 0.1))
  setColor("modal", dark ? mix(accent.primary, "#161B24", 0.05) : "#FFFFFF")
  setColor("chrome", chrome)
  setColor("backdrop", dark ? colorWithOpacity("#05070A", 0.72) : colorWithOpacity("#0B1220", 0.45))

  setGradient(
    "background",
    dark
      ? [mix(accent.primary, "#0B0E14", 0.08), background, chrome]
      : ["#FFFFFF", background, mix(accent.primary, LIGHT_BASE, 0.06)],
  )
  setGradient(
    "card",
    dark ? [mix(accent.primary, "#161B24", 0.05), "#12161E"] : ["#FFFFFF", mix(accent.primary, "#F2F5F9", 0.3)],
  )
  setGradient(
    "cardHigh",
    dark ? ["#1C222E", "#151A23"] : ["#FFFFFF", mix(accent.primary, "#EDF1F7", 0.25)],
  )
  setGradient("primary", [accent.primary, accent.primaryStrong])
  setGradient("primaryDeep", [accent.primaryStrong, mix(accent.primaryStrong, "#000000", 0.25)])
  setGradient("accent", [accent.accent, mix(accent.accent, "#000000", 0.2)])

  Theme.shadows.glow.boxShadow = `0px 0px 16px ${colorWithOpacity(accent.primary, 0.4)}`
  Theme.shadows.glowDanger.boxShadow = `0px 0px 14px ${colorWithOpacity(Theme.colors.danger, 0.4)}`
}

const notify = (): void => {
  snapshot += 1
  listeners.forEach((listener) => listener())
}

export const getAppearance = (): Appearance => appearance

/** Applies and (optionally) persists an appearance selection. */
export const applyAppearance = (
  next: Partial<Appearance>,
  options: { persist?: boolean } = {},
): void => {
  appearance = {
    mode: next.mode ?? appearance.mode,
    accent: next.accent ?? appearance.accent,
  }
  buildPalette(getAccent(appearance.accent), appearance.mode)
  if (options.persist !== false) {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(appearance))
  }
  notify()
}

/** Applies a single accent (used by the appearance settings screen). */
export const applyAccent = (accent: AccentId): void => applyAppearance({ accent })

/** Applies light/dark mode (used by the appearance settings screen). */
export const applyAppearanceMode = (mode: AppearanceMode): void => applyAppearance({ mode })

export const resetAppearance = (): void =>
  applyAppearance({ mode: "dark", accent: DEFAULT_ACCENT })

/** Restores the last persisted appearance. Called once during app start-up. */
export const hydrateAppearance = async (): Promise<Appearance> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      const value = parsed as Partial<Appearance>
      applyAppearance(
        {
          mode: isAppearanceMode(String(value.mode)) ? value.mode : undefined,
          accent: value.accent ?? undefined,
        },
        { persist: false },
      )
    }
  } catch {
    // A corrupted preference must never block the app: keep the defaults.
  }
  return appearance
}

const subscribeAppearance = (listener: Listener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = (): number => snapshot

/** Version counter that changes whenever the palette is replaced. */
export const useThemeVersion = (): number =>
  useSyncExternalStore(subscribeAppearance, getSnapshot, getSnapshot)
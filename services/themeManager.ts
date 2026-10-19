import { useSyncExternalStore } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Appearance as SystemAppearance } from "react-native"
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

const STORAGE_KEY = "setuno:appearance:v1"

const listeners = new Set<Listener>()
let appearance: Appearance = { mode: "dark", accent: DEFAULT_ACCENT }
let snapshot = 0

/** Deep night / soft paper bases, plus the ink used to darken light mode. */
const DARK_BASE = "#0B0B14"
const LIGHT_BASE = "#F7F7FB"
const INK = "#0A0A12"

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "").padEnd(6, "0").slice(0, 6)
  const value = parseInt(clean, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

const rgbToHex = (rgb: [number, number, number]): string =>
  `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`

/** Lerp from `a` to `b` by `amount` (0 = a, 1 = b). */
const mix = (a: string, b: string, amount: number): string => {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return rgbToHex([
    ca[0] + (cb[0] - ca[0]) * amount,
    ca[1] + (cb[1] - ca[1]) * amount,
    ca[2] + (cb[2] - ca[2]) * amount,
  ])
}

/** Shifts a colour towards the near-black ink (keeps light mode legible). */
const darken = (color: string, amount: number): string => mix(color, INK, amount)

const setColor = (key: ThemeColorKey, value: string): void => {
  ;(Theme.colors as Record<ThemeColorKey, string>)[key] = value
}

const setGradient = (key: keyof typeof Theme.gradients, value: readonly string[]): void => {
  ;(Theme.gradients as unknown as Record<string, readonly string[]>)[key] = value
}

/**
 * Derives the full colour token set for a given accent + appearance mode.
 *
 * Dark surfaces are tinted a few percent towards the accent so the product
 * keeps its identity without losing depth. In light mode the accent itself is
 * darkened (and `onPrimary` flips to white) so text, icons and buttons keep a
 * comfortable contrast ratio on paper-white surfaces.
 */
const buildPalette = (accent: AccentPalette, mode: "dark" | "light"): void => {
  const dark = mode === "dark"

  // Dark mode lifts `primary` a touch more than the accent ships it: low-luminance
  // primaries (ember orange, indigo) must carry ghost-button labels and badge text
  // over the raised surfaces too, and AA pins the pair (themeContrast test).
  const primary = dark ? mix(accent.primary, "#FFFFFF", 0.13) : darken(accent.primary, 0.5)
  const primaryStrong = dark ? accent.primaryStrong : darken(accent.primaryStrong, 0.5)
  // Light mode darkens the accent further (0.52 left amber/pink marginal on the
  // soft chips and the raised surfaces): chord labels and badge text are caption
  // size, so they are held to the 4.5:1 body-text threshold, not the large-text one.
  const highlight = dark ? accent.accent : darken(accent.accent, 0.6)
  const onPrimary = dark ? accent.onPrimary : "#FFFFFF"

  // Surfaces tint towards `primaryStrong` in dark mode, never `primary`: bright
  // accents (sky, indigo) otherwise lift the raised surfaces until dim text can
  // no longer clear AA against them (textFaint on surfaceMuted was the canary).
  const tint = dark ? primaryStrong : primary
  const background = dark ? mix(DARK_BASE, tint, 0.05) : mix(LIGHT_BASE, tint, 0.035)
  const surface = dark ? mix("#141420", tint, 0.05) : "#FFFFFF"
  const surfaceHigh = dark ? mix("#1D1D2B", tint, 0.07) : mix("#FFFFFF", tint, 0.04)
  const surfaceMuted = dark ? mix("#262636", tint, 0.07) : mix("#EDEDF6", tint, 0.08)
  const border = dark ? mix("#2C2C3F", primary, 0.2) : mix("#DFDFEC", primary, 0.18)
  const chrome = dark ? mix("#0D0D17", tint, 0.04) : "#FFFFFF"
  const modal = dark ? mix("#191926", tint, 0.05) : "#FFFFFF"

  const success = dark ? "#34D399" : "#065F46"
  const warning = dark ? "#FBBF24" : "#92400E"
  const danger = dark ? "#FF6B7A" : "#B91C1C"

  setColor("background", background)
  setColor("background2", dark ? mix(background, surface, 0.6) : mix(background, surface, 0.7))
  setColor("text", dark ? "#F8F8FC" : "#14141E")
  setColor("textMuted", dark ? "#ADAEC6" : "#54566E")
  setColor("textFaint", dark ? "#9698B0" : "#5A5C74")
  setColor("primary", primary)
  setColor("primaryStrong", primaryStrong)
  // Dark soft fills are deliberately faint (AA pins the alpha, see below): they
  // are redundant backing behind tone-coloured caption text, and a stronger chip
  // would lift its own background until that text can no longer pass 4.5:1.
  // 0.08 is the narrow window that satisfies both AA and perceptibility for the
  // lowest-luminance accent (ember orange).
  setColor("primarySoft", colorWithOpacity(primary, dark ? 0.08 : 0.11))
  setColor("onPrimary", onPrimary)
  setColor("accent", highlight)
  setColor("accentSoft", colorWithOpacity(highlight, dark ? 0.08 : 0.14))
  setColor("success", success)
  setColor("successSoft", colorWithOpacity(success, dark ? 0.08 : 0.12))
  setColor("warning", warning)
  setColor("warningSoft", colorWithOpacity(warning, dark ? 0.08 : 0.12))
  setColor("danger", danger)
  setColor("dangerSoft", colorWithOpacity(danger, dark ? 0.08 : 0.12))
  setColor("surface", surface)
  setColor("surfaceHigh", surfaceHigh)
  setColor("surfaceMuted", surfaceMuted)
  setColor("border", border)
  setColor("borderSoft", dark ? colorWithOpacity("#FFFFFF", 0.09) : colorWithOpacity(INK, 0.09))
  setColor("modal", modal)
  setColor("chrome", chrome)
  setColor("backdrop", dark ? colorWithOpacity("#05050C", 0.66) : colorWithOpacity(INK, 0.45))
  setColor("overlay", dark ? colorWithOpacity("#05050C", 0.88) : colorWithOpacity(INK, 0.62))

  setGradient(
    "background",
    dark
      ? [mix(DARK_BASE, primary, 0.09), background, chrome]
      : ["#FFFFFF", background, mix(LIGHT_BASE, primary, 0.07)],
  )
  setGradient(
    "card",
    dark ? [surfaceHigh, surface] : ["#FFFFFF", mix("#F1F1F9", primary, 0.3)],
  )
  setGradient(
    "cardHigh",
    dark ? [mix("#242436", primary, 0.08), surfaceHigh] : ["#FFFFFF", mix("#E9E9F4", primary, 0.25)],
  )
  setGradient("primary", [primary, primaryStrong])
  setGradient("primaryDeep", [primaryStrong, mix(primaryStrong, "#000000", 0.22)])
  setGradient("accent", [highlight, mix(highlight, "#000000", 0.18)])
  setGradient("danger", dark ? ["#FF7A87", "#DC2626"] : ["#F87171", "#B91C1C"])

  Theme.shadows.glow.boxShadow = `0px 0px 16px ${colorWithOpacity(primary, 0.42)}`
  Theme.shadows.glowDanger.boxShadow = `0px 0px 14px ${colorWithOpacity(danger, 0.42)}`
}

const notify = (): void => {
  snapshot += 1
  listeners.forEach((listener) => listener())
}

export const getAppearance = (): Appearance => appearance

/** Collapses "system" onto the current device/browser colour scheme. */
export const resolveAppearanceMode = (mode: AppearanceMode): "dark" | "light" =>
  mode === "system"
    ? SystemAppearance.getColorScheme() === "light"
      ? "light"
      : "dark"
    : mode

/** Applies and (optionally) persists an appearance selection. */
export const applyAppearance = (
  next: Partial<Appearance>,
  options: { persist?: boolean } = {},
): void => {
  appearance = {
    mode: next.mode ?? appearance.mode,
    accent: next.accent ?? appearance.accent,
  }
  buildPalette(getAccent(appearance.accent), resolveAppearanceMode(appearance.mode))
  if (options.persist !== false) {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(appearance))
  }
  notify()
}

/**
 * Keeps "system" in step with the OS: when the device flips between light and
 * dark the palette is rebuilt without touching the stored preference.
 */
let systemSchemeSubscription: { remove: () => void } | null = null

const watchSystemScheme = (): void => {
  if (systemSchemeSubscription) return
  systemSchemeSubscription = SystemAppearance.addChangeListener(({ colorScheme }) => {
    if (appearance.mode !== "system") return
    buildPalette(getAccent(appearance.accent), colorScheme === "light" ? "light" : "dark")
    notify()
  })
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
  watchSystemScheme()
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
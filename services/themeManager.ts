import { useSyncExternalStore } from "react"
import { Theme } from "@/constants/Theme"
import { ThemeDef, getThemeById } from "@/libs/themes"

type Listener = () => void

type GradientValue =
  readonly [string, string] | readonly [string, string, string]

const listeners = new Set<Listener>()
let activeThemeId = "default"
let snapshot = 0

const setColor = (key: keyof (typeof Theme)["colors"], value: string): void => {
  ;(Theme.colors as Record<keyof (typeof Theme)["colors"], string>)[key] = value
}

const setGradient = (key: string, value: GradientValue): void => {
  ;(Theme.gradients as unknown as Record<string, GradientValue>)[key] = value
}

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "").padEnd(6, "0").slice(0, 6)
  const num = parseInt(clean, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

const rgbToHex = (rgb: [number, number, number]): string =>
  `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`

const mix = (a: string, b: string, t: number): string => {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return rgbToHex([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ])
}

const DARK = "#050808"

const deriveSurfaces = (primary: string) => ({
  background: mix(primary, DARK, 0.72),
  background2: mix(primary, DARK, 0.78),
  surface: mix(primary, DARK, 0.8),
  surfaceHigh: mix(primary, DARK, 0.68),
  borderSoft: mix(primary, DARK, 0.52),
  modal: mix(primary, DARK, 0.76),
  gradientBackground: [
    mix(primary, DARK, 0.58),
    mix(primary, DARK, 0.82),
    mix(primary, DARK, 0.72),
  ] as [string, string, string],
  gradientCard: [mix(primary, DARK, 0.66), mix(primary, DARK, 0.84)] as [
    string,
    string,
  ],
  gradientCardHigh: [mix(primary, DARK, 0.56), mix(primary, DARK, 0.74)] as [
    string,
    string,
  ],
})

export const getActiveThemeId = (): string => activeThemeId

export const applyThemePalette = (theme: ThemeDef): void => {
  const c = theme.palette
  const s = deriveSurfaces(c.primary)
  setColor("background", s.background)
  setColor("background2", s.background2)
  setColor("surface", s.surface)
  setColor("surfaceHigh", s.surfaceHigh)
  setColor("borderSoft", s.borderSoft)
  setColor("modal", s.modal)
  setColor("primary", c.primary)
  setColor("primary2", c.primary2)
  setColor("primarySoft", c.primarySoft)
  setColor("secondary", c.secondary)
  setColor("accent", c.accent)
  setGradient("background", s.gradientBackground)
  setGradient("card", s.gradientCard)
  setGradient("cardHigh", s.gradientCardHigh)
  setGradient("primary", c.gradientPrimary)
  setGradient("primaryDeep", c.gradientDeep)
  setGradient("accent", c.gradientAccent)
  Theme.shadows.glow.shadowColor = c.glow
  activeThemeId = theme.id
  snapshot += 1
  listeners.forEach((listener) => listener())
}

export const applyThemeById = (id: string): void => {
  applyThemePalette(getThemeById(id))
}

export const resetTheme = (): void => {
  applyThemeById("default")
}

const subscribeTheme = (listener: Listener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = (): number => snapshot

export const useThemeVersion = (): number =>
  useSyncExternalStore(subscribeTheme, getSnapshot, getSnapshot)

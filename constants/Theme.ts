import { Dimensions } from "react-native"

export const colorWithOpacity = (color: string, opacity: number): string => {
  const match = /^#?([\da-f]{6})$/i.exec(color)
  if (!match) return color
  const value = parseInt(match[1], 16)
  const red = (value >> 16) & 255
  const green = (value >> 8) & 255
  const blue = value & 255
  const alpha = Math.max(0, Math.min(1, opacity))
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

const { width, height } = Dimensions.get("screen")

/** Layout breakpoints shared by the responsive shell (shared with web). */
export const breakpoints = {
  mobile: 0,
  largePhone: 430,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
} as const

/**
 * Stage Book design tokens.
 *
 * `Theme.colors` is a mutable singleton so the appearance settings can switch
 * between light/dark and accents at runtime (see services/appearance.ts).
 * Components read these tokens directly and re-render through
 * `useThemedStyles` / `useThemeVersion`.
 */
export const Theme = {
  colors: {
    /** Page background. */
    background: "#0A0C10",
    /** Slightly tinted background used behind grouped content. */
    background2: "#0E1117",
    /** Default text colour. */
    text: "#F5F7FA",
    /** Muted/secondary text. */
    textMuted: "#9AA4B2",
    /** Tertiary text and disabled states. */
    textFaint: "#6B7480",
    primary: "#14B8A6",
    primarySoft: colorWithOpacity("#14B8A6", 0.16),
    primaryStrong: "#0D9488",
    onPrimary: "#04201E",
    /** Accent used for highlights such as chord labels. */
    accent: "#F5A524",
    accentSoft: colorWithOpacity("#F5A524", 0.16),
    success: "#34D399",
    successSoft: colorWithOpacity("#34D399", 0.14),
    warning: "#FBBF24",
    warningSoft: colorWithOpacity("#FBBF24", 0.14),
    danger: "#F87171",
    dangerSoft: colorWithOpacity("#F87171", 0.14),
    /** Cards and elevated surfaces. */
    surface: "#131720",
    /** Inputs / pressed surfaces. */
    surfaceHigh: "#1B212C",
    /** Subtle fills (chips, skeletons). */
    surfaceMuted: "#202734",
    border: "#232B38",
    borderSoft: colorWithOpacity("#FFFFFF", 0.08),
    /** Modal / dialog background. */
    modal: "#161B24",
    backdrop: colorWithOpacity("#05070A", 0.72),
    transparent: "#00000000",
    /** Sidebar / bottom navigation background. */
    chrome: "#0D1017",
    overlay: colorWithOpacity("#05070A", 0.86),
  },
  gradients: {
    background: ["#0B0E14", "#0A0C10", "#0D1017"] as const,
    card: ["#161B24", "#12161E"] as const,
    cardHigh: ["#1C222E", "#151A23"] as const,
    primary: ["#19C3B0", "#0D9488"] as const,
    primaryDeep: ["#0D9488", "#0F766E"] as const,
    danger: ["#F87171", "#DC2626"] as const,
    accent: ["#F5A524", "#F59E0B"] as const,
  },
  fonts: {
    onest: "Onest",
    onestBold: "OnestBold",
    /** Monospaced face used by the chord/lyric editor. */
    mono: "monospace",
  },
  sizes: {
    hero: 34,
    display: 30,
    h0: 24,
    h1: 21,
    h2: 19,
    h3: 17,
    h4: 15,
    h5: 13,
    h6: 12,
    caption: 11,
    width,
    height,
  },
  spacing: {
    xxs: 2,
    xs: 4,
    s: 8,
    m: 12,
    l: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 44,
  },
  radii: {
    xs: 6,
    s: 10,
    m: 14,
    lg: 18,
    xl: 24,
    xxl: 30,
    pill: 999,
  },
  /** Minimum comfortable touch target (accessibility). */
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
  shadows: {
    sm: {
      boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.24)",
      elevation: 3,
    },
    md: {
      boxShadow: "0px 6px 14px rgba(0, 0, 0, 0.28)",
      elevation: 6,
    },
    lg: {
      boxShadow: "0px 14px 28px rgba(0, 0, 0, 0.34)",
      elevation: 12,
    },
    glow: {
      boxShadow: `0px 0px 16px ${colorWithOpacity("#14B8A6", 0.4)}`,
      elevation: 8,
    },
    glowDanger: {
      boxShadow: `0px 0px 14px ${colorWithOpacity("#F87171", 0.4)}`,
      elevation: 7,
    },
    text: {
      textShadowColor: "rgba(0,0,0,0.5)",
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 3,
    },
  },
}

/** Columns for the responsive grid used across list screens. */
export const grid = {
  gap: Theme.spacing.m,
  minCardWidth: 280,
  compactWidth: 168,
} as const

export type ThemeColorKey = keyof typeof Theme.colors
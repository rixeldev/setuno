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
    background: "#0B0B14",
    /** Slightly tinted background used behind grouped content. */
    background2: "#11111C",
    /** Default text colour. */
    text: "#F8F8FC",
    /** Muted/secondary text. */
    textMuted: "#ADAEC6",
    /** Tertiary text and disabled states. */
    textFaint: "#8A8CA3",
    primary: "#EA580C",
    primarySoft: colorWithOpacity("#EA580C", 0.18),
    primaryStrong: "#C2410C",
    onPrimary: "#2B1003",
    /** Accent used for highlights such as chord labels. */
    accent: "#2DD4BF",
    accentSoft: colorWithOpacity("#2DD4BF", 0.16),
    success: "#34D399",
    successSoft: colorWithOpacity("#34D399", 0.16),
    warning: "#FBBF24",
    warningSoft: colorWithOpacity("#FBBF24", 0.16),
    danger: "#FF6B7A",
    dangerSoft: colorWithOpacity("#FF6B7A", 0.16),
    /** Cards and elevated surfaces. */
    surface: "#16161F",
    /** Inputs / pressed surfaces. */
    surfaceHigh: "#1F1F2C",
    /** Subtle fills (chips, skeletons). */
    surfaceMuted: "#282838",
    border: "#2E2E42",
    borderSoft: colorWithOpacity("#FFFFFF", 0.09),
    /** Modal / dialog background. */
    modal: "#1A1A26",
    backdrop: colorWithOpacity("#05050C", 0.66),
    transparent: "#00000000",
    /** Sidebar / bottom navigation background. */
    chrome: "#0E0E17",
    overlay: colorWithOpacity("#05050C", 0.88),
  },
  gradients: {
    background: ["#10101C", "#0B0B14", "#0E0E17"] as const,
    card: ["#1B1B2A", "#15151F"] as const,
    cardHigh: ["#242436", "#1B1B2A"] as const,
    primary: ["#F97316", "#C2410C"] as const,
    primaryDeep: ["#C2410C", "#9A3412"] as const,
    danger: ["#FF7A87", "#DC2626"] as const,
    accent: ["#2DD4BF", "#0D9488"] as const,
  },
  fonts: {
    onest: "Onest",
    onestBold: "OnestBold",
    /**
     * Monospaced face for the chord rows and lyric grids. It ships with the app
     * (registered in the root layout) because Android's system `monospace` is
     * not truly monospaced for every glyph, which made the padded chord columns
     * drift left while web looked fine.
     */
    mono: "Mono",
  },
  sizes: {
    hero: 31,
    display: 29,
    h0: 23,
    h1: 20,
    h2: 18,
    h3: 16,
    h4: 14,
    h5: 12,
    h6: 11,
    caption: 10,
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
      boxShadow: `0px 0px 16px ${colorWithOpacity("#EA580C", 0.42)}`,
      elevation: 8,
    },
    glowDanger: {
      boxShadow: `0px 0px 14px ${colorWithOpacity("#FF6B7A", 0.42)}`,
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

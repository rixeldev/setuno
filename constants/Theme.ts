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

export const Theme = {
  colors: {
    background: "#000B0A",
    background2: "#001514ff",
    text: "#FFFBFB",
    primary: "#008080",
    primary2: "#00808027",
    secondary: "#D9F4F3",
    accent: "#008080",
    red: "#FF5555",
    green: "#4CFF4C",
    yellow: "#ffe989",
    gray: "#A9A9A9",
    lightGray: "#D3D3D3",
    darkGray: "#5A6B6A",
    border: "#333333",
    modal: "#001c1aff",
    transparent: "#00000000",
    backdrop: "#000000B3",
    surface: "#041F1C",
    surfaceHigh: "#0A2A26",
    borderSoft: "#0E4A44",
    primarySoft: "#0A8F8F",
  },
  gradients: {
    background: ["#021B18", "#000B0A", "#001311"] as const,
    card: ["#03231F", "#011613"] as const,
    cardHigh: ["#07302B", "#021A17"] as const,
    primary: ["#04A8A8", "#007170"] as const,
    primaryDeep: ["#007070", "#005B59"] as const,
    danger: ["#FF4D4D", "#C22020"] as const,
    accent: ["#008080", "#D9F4F3"] as const,
    overlay: ["#00000000", "#000000B3"] as const,
  },
  fonts: {
    onest: "Onest",
    onestBold: "OnestBold",
  },
  sizes: {
    h0: 24,
    h1: 22,
    h2: 20,
    h3: 18,
    h4: 16,
    h5: 14,
    h6: 12,
    hero: 36,
    display: 32,
    width,
    height,
  },
  spacing: {
    xs: 4,
    s: 8,
    m: 12,
    l: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radii: {
    s: 8,
    m: 12,
    lg: 16,
    xl: 20,
    xxl: 26,
    pill: 999,
  },
  shadows: {
    sm: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 3,
    },
    md: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 6,
    },
    lg: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 10,
    },
    glow: {
      shadowColor: "#008080",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.45,
      shadowRadius: 16,
      elevation: 8,
    },
    glowDanger: {
      shadowColor: "#FF5555",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 14,
      elevation: 7,
    },
    text: {
      textShadowColor: "rgba(0,0,0,0.5)",
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 3,
    },
  },
}

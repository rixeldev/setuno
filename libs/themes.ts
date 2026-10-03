export type ThemeCurrency = "coins" | "gems"

export interface ThemePrice {
  currency: ThemeCurrency
  amount: number
}

export interface ThemePalette {
  primary: string
  primary2: string
  primarySoft: string
  secondary: string
  accent: string
  gradientPrimary: [string, string]
  gradientDeep: [string, string]
  gradientAccent: [string, string]
  glow: string
}

export interface ThemeDef {
  id: string
  price: ThemePrice
  palette: ThemePalette
}

export const DEFAULT_THEME_ID = "default"

const t = (
  id: string,
  price: ThemePrice,
  palette: ThemePalette,
): ThemeDef => ({ id, price, palette })

export const THEMES: ThemeDef[] = [
  t("default", { currency: "coins", amount: 0 }, {
    primary: "#008080",
    primary2: "#00808027",
    primarySoft: "#0A8F8F",
    secondary: "#D9F4F3",
    accent: "#008080",
    gradientPrimary: ["#04A8A8", "#007170"],
    gradientDeep: ["#007070", "#005B59"],
    gradientAccent: ["#008080", "#D9F4F3"],
    glow: "#008080",
  }),
  t("ocean", { currency: "coins", amount: 5000 }, {
    primary: "#1E88E5",
    primary2: "#1E88E527",
    primarySoft: "#42A5F5",
    secondary: "#E3F2FD",
    accent: "#29B6F6",
    gradientPrimary: ["#42A5F5", "#1565C0"],
    gradientDeep: ["#1565C0", "#0D47A1"],
    gradientAccent: ["#1E88E5", "#E3F2FD"],
    glow: "#1E88E5",
  }),
  t("forest", { currency: "coins", amount: 5000 }, {
    primary: "#2E7D32",
    primary2: "#2E7D3227",
    primarySoft: "#43A047",
    secondary: "#E8F5E9",
    accent: "#66BB6A",
    gradientPrimary: ["#43A047", "#1B5E20"],
    gradientDeep: ["#1B5E20", "#0D3B12"],
    gradientAccent: ["#2E7D32", "#E8F5E9"],
    glow: "#2E7D32",
  }),
  t("sunset", { currency: "coins", amount: 10000 }, {
    primary: "#FB8C00",
    primary2: "#FB8C0027",
    primarySoft: "#FFA726",
    secondary: "#FFF3E0",
    accent: "#FF7043",
    gradientPrimary: ["#FFA726", "#E65100"],
    gradientDeep: ["#E65100", "#BF360C"],
    gradientAccent: ["#FB8C00", "#FFF3E0"],
    glow: "#FB8C00",
  }),
  t("purple", { currency: "gems", amount: 50 }, {
    primary: "#9575CD",
    primary2: "#9575CD27",
    primarySoft: "#B39DDB",
    secondary: "#EDE7F6",
    accent: "#AB47BC",
    gradientPrimary: ["#B39DDB", "#5E35B1"],
    gradientDeep: ["#5E35B1", "#4527A0"],
    gradientAccent: ["#9575CD", "#EDE7F6"],
    glow: "#9575CD",
  }),
  t("rose", { currency: "gems", amount: 200 }, {
    primary: "#EC407A",
    primary2: "#EC407A27",
    primarySoft: "#F48FB1",
    secondary: "#FCE4EC",
    accent: "#D81B60",
    gradientPrimary: ["#F48FB1", "#C2185B"],
    gradientDeep: ["#C2185B", "#880E4F"],
    gradientAccent: ["#EC407A", "#FCE4EC"],
    glow: "#EC407A",
  }),
  t("cyber", { currency: "gems", amount: 100 }, {
    primary: "#00E5FF",
    primary2: "#00E5FF27",
    primarySoft: "#4DD0E1",
    secondary: "#E0F7FA",
    accent: "#FF006E",
    gradientPrimary: ["#00E5FF", "#2979FF"],
    gradientDeep: ["#2979FF", "#1A237E"],
    gradientAccent: ["#00E5FF", "#FF006E"],
    glow: "#00E5FF",
  }),
  t("gold", { currency: "gems", amount: 250 }, {
    primary: "#FBC02D",
    primary2: "#FBC02D27",
    primarySoft: "#FFD54F",
    secondary: "#FFF8E1",
    accent: "#F57F17",
    gradientPrimary: ["#FFD54F", "#F57F17"],
    gradientDeep: ["#F57F17", "#B5610B"],
    gradientAccent: ["#FBC02D", "#FFF8E1"],
    glow: "#FBC02D",
  }),
  t("midnight", { currency: "gems", amount: 300 }, {
    primary: "#7B1FA2",
    primary2: "#7B1FA227",
    primarySoft: "#9C27B0",
    secondary: "#F3E5F5",
    accent: "#536DFE",
    gradientPrimary: ["#9C27B0", "#4527A0"],
    gradientDeep: ["#4527A0", "#1A237E"],
    gradientAccent: ["#7B1FA2", "#536DFE"],
    glow: "#7B1FA2",
  }),
  t("neon", { currency: "gems", amount: 500 }, {
    primary: "#76FF03",
    primary2: "#76FF0327",
    primarySoft: "#B2FF59",
    secondary: "#F1F8E9",
    accent: "#FF1744",
    gradientPrimary: ["#B2FF59", "#00E676"],
    gradientDeep: ["#00E676", "#00B8D4"],
    gradientAccent: ["#76FF03", "#FF1744"],
    glow: "#76FF03",
  }),
  t("crimson", { currency: "gems", amount: 150 }, {
    primary: "#E53935",
    primary2: "#E5393527",
    primarySoft: "#EF5350",
    secondary: "#FFEBEE",
    accent: "#B71C1C",
    gradientPrimary: ["#EF5350", "#C62828"],
    gradientDeep: ["#C62828", "#7F0000"],
    gradientAccent: ["#E53935", "#FFEBEE"],
    glow: "#E53935",
  }),
  t("ice", { currency: "coins", amount: 15000 }, {
    primary: "#4FC3F7",
    primary2: "#4FC3F727",
    primarySoft: "#81D4FA",
    secondary: "#E1F5FE",
    accent: "#B3E5FC",
    gradientPrimary: ["#81D4FA", "#0288D1"],
    gradientDeep: ["#0288D1", "#01579B"],
    gradientAccent: ["#4FC3F7", "#E1F5FE"],
    glow: "#4FC3F7",
  }),
  t("mint", { currency: "coins", amount: 8000 }, {
    primary: "#26A69A",
    primary2: "#26A69A27",
    primarySoft: "#4DB6AC",
    secondary: "#E0F2F1",
    accent: "#80CBC4",
    gradientPrimary: ["#4DB6AC", "#00796B"],
    gradientDeep: ["#00796B", "#004D40"],
    gradientAccent: ["#26A69A", "#E0F2F1"],
    glow: "#26A69A",
  }),
  t("coral", { currency: "gems", amount: 150 }, {
    primary: "#FF7043",
    primary2: "#FF704327",
    primarySoft: "#FF8A65",
    secondary: "#FBE9E7",
    accent: "#FF5252",
    gradientPrimary: ["#FF8A65", "#E64A19"],
    gradientDeep: ["#E64A19", "#BF360C"],
    gradientAccent: ["#FF7043", "#FBE9E7"],
    glow: "#FF7043",
  }),
  t("sapphire", { currency: "gems", amount: 200 }, {
    primary: "#3949AB",
    primary2: "#3949AB27",
    primarySoft: "#5C6BC0",
    secondary: "#E8EAF6",
    accent: "#3F51B5",
    gradientPrimary: ["#5C6BC0", "#283593"],
    gradientDeep: ["#283593", "#1A237E"],
    gradientAccent: ["#3949AB", "#E8EAF6"],
    glow: "#3949AB",
  }),
  t("ember", { currency: "gems", amount: 250 }, {
    primary: "#D84315",
    primary2: "#D8431527",
    primarySoft: "#FF7043",
    secondary: "#FBE9E7",
    accent: "#FFAB40",
    gradientPrimary: ["#FF7043", "#BF360C"],
    gradientDeep: ["#BF360C", "#7F2306"],
    gradientAccent: ["#FFAB40", "#D84315"],
    glow: "#D84315",
  }),
  t("orchid", { currency: "gems", amount: 300 }, {
    primary: "#BA68C8",
    primary2: "#BA68C827",
    primarySoft: "#CE93D8",
    secondary: "#F3E5F5",
    accent: "#E040FB",
    gradientPrimary: ["#CE93D8", "#8E24AA"],
    gradientDeep: ["#8E24AA", "#4A148C"],
    gradientAccent: ["#BA68C8", "#E040FB"],
    glow: "#BA68C8",
  }),
  t("lime", { currency: "coins", amount: 12000 }, {
    primary: "#AFB42B",
    primary2: "#AFB42B27",
    primarySoft: "#CDDC39",
    secondary: "#F9FBE7",
    accent: "#9E9D24",
    gradientPrimary: ["#CDDC39", "#827717"],
    gradientDeep: ["#827717", "#524C00"],
    gradientAccent: ["#AFB42B", "#F9FBE7"],
    glow: "#AFB42B",
  }),
  t("cocoa", { currency: "coins", amount: 6000 }, {
    primary: "#8D6E63",
    primary2: "#8D6E6327",
    primarySoft: "#A1887F",
    secondary: "#EFEBE9",
    accent: "#D7CCC8",
    gradientPrimary: ["#A1887F", "#5D4037"],
    gradientDeep: ["#5D4037", "#3E2723"],
    gradientAccent: ["#8D6E63", "#EFEBE9"],
    glow: "#8D6E63",
  }),
  t("steel", { currency: "gems", amount: 180 }, {
    primary: "#546E7A",
    primary2: "#546E7A27",
    primarySoft: "#78909C",
    secondary: "#ECEFF1",
    accent: "#B0BEC5",
    gradientPrimary: ["#78909C", "#37474F"],
    gradientDeep: ["#37474F", "#263238"],
    gradientAccent: ["#546E7A", "#ECEFF1"],
    glow: "#546E7A",
  }),
  t("galaxy", { currency: "gems", amount: 450 }, {
    primary: "#5E35B1",
    primary2: "#5E35B127",
    primarySoft: "#7E57C2",
    secondary: "#EDE7F6",
    accent: "#EC407A",
    gradientPrimary: ["#7E57C2", "#311B92"],
    gradientDeep: ["#311B92", "#1A0033"],
    gradientAccent: ["#5E35B1", "#EC407A"],
    glow: "#5E35B1",
  }),
  t("aurora", { currency: "gems", amount: 500 }, {
    primary: "#26C6DA",
    primary2: "#26C6DA27",
    primarySoft: "#4DD0E1",
    secondary: "#E0F7FA",
    accent: "#AB47BC",
    gradientPrimary: ["#4DD0E1", "#00897B"],
    gradientDeep: ["#00897B", "#4A148C"],
    gradientAccent: ["#26C6DA", "#AB47BC"],
    glow: "#26C6DA",
  }),
]

export const getThemeById = (id: string): ThemeDef =>
  THEMES.find((theme) => theme.id === id) ?? THEMES[0]

export const isDefaultTheme = (id: string) => id === DEFAULT_THEME_ID
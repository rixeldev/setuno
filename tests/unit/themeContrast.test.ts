import { beforeAll, describe, expect, it, vi } from "vitest"

import { Theme, colorWithOpacity } from "@/constants/Theme"
import { applyAppearance } from "@/services/themeManager"
import { ACCENTS } from "@/libs/appearance"
import type { AccentId } from "@/interfaces/user"

// The palette derivation lives in services/themeManager.ts, which imports two
// native modules at the top level. The maths itself is pure, so a two-line mock
// is enough to exercise every accent x mode combination in Node (P0.10 / #83).
// vitest hoists static `vi.mock` calls above the imports, so this works here.
vi.mock("react-native", () => ({
  Appearance: { getColorScheme: () => "dark", addChangeListener: () => ({ remove: () => {} }) },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
}))
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}))

/** WCAG 2.x relative luminance. */
const luminance = (hex: string): number => {
  const match = /^#?([\da-f]{6})$/i.exec(hex)
  if (!match) throw new Error(`not a hex colour: ${hex}`)
  const value = parseInt(match[1], 16)
  const channel = (raw: number): number => {
    const c = raw / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return (
    0.2126 * channel((value >> 16) & 255) +
    0.7152 * channel((value >> 8) & 255) +
    0.0722 * channel(value & 255)
  )
}

const ratio = (a: string, b: string): number => {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Alpha-composite `fg` (a colorWithOpacity string) over an opaque `bg`. */
const over = (fg: string, bg: string): string => {
  const parse = (hex: string): [number, number, number] => {
    const match = /^#?([\da-f]{6})$/i.exec(hex)
    if (!match) throw new Error(`not a hex colour: ${hex}`)
    const value = parseInt(match[1], 16)
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  }
  const rgba = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(fg)
  if (!rgba) return fg // already opaque
  const [fr, fgG, fb] = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])]
  const alpha = Number(rgba[4])
  const [br, bgG, bb] = parse(bg)
  const blend = (f: number, b: number): number => Math.round(f * alpha + b * (1 - alpha))
  return `#${((1 << 24) + (blend(fr, br) << 16) + (blend(fgG, bgG) << 8) + blend(fb, bb))
    .toString(16)
    .slice(1)}`
}

/** AA thresholds: normal text, and non-text UI (borders of controls). */
const AA_TEXT = 4.5
const AA_LARGE_OR_UI = 3

const MODES = ["dark", "light"] as const
const ACCENT_IDS = Object.keys(ACCENTS) as AccentId[]

/** Host surfaces text actually lands on (cards, chrome, dialogs, pages). */
const HOSTS = ["background", "background2", "surface", "surfaceHigh", "surfaceMuted", "chrome", "modal"] as const

/** Foreground tones a reader can meet as body-size content. */
const TEXT_TONES = ["text", "textMuted", "textFaint", "primary", "accent", "danger", "success"] as const

describe.each(ACCENT_IDS.map((accent) => [accent] as const))(
  "theme contrast (WCAG AA) — accent %s",
  (accentId) => {
    describe.each(MODES.map((mode) => [mode] as const))("mode %s", (mode) => {
      beforeAll(() => {
        applyAppearance({ mode, accent: accentId })
      })

      it.each(TEXT_TONES.flatMap((tone) => HOSTS.map((host) => [tone, host] as const)))(
        "%s on %s ≥ 4.5",
        (tone, host) => {
          expect(ratio(Theme.colors[tone], Theme.colors[host])).toBeGreaterThanOrEqual(AA_TEXT)
        },
      )

      it("button labels: onPrimary on the primary/danger fills ≥ 4.5", () => {
        // `primaryStrong` only ever paints gradient ends (never behind text), so
        // the fill that carries labels is `primary` itself — the gradient's
        // brightest end is the same token.
        expect(ratio(Theme.colors.onPrimary, Theme.colors.primary)).toBeGreaterThanOrEqual(AA_TEXT)
        expect(ratio(Theme.colors.onPrimary, Theme.colors.danger)).toBeGreaterThanOrEqual(AA_TEXT)
      })

      it.each([
        ["primary", "primarySoft"],
        ["accent", "accentSoft"],
        ["danger", "dangerSoft"],
        ["success", "successSoft"],
        ["warning", "warningSoft"],
      ] as const)("badge text %s on %s (over surface and background) ≥ 4.5", (tone, soft) => {
        for (const host of ["surface", "background"] as const) {
          const chipBg = over(Theme.colors[soft], Theme.colors[host])
          expect(ratio(Theme.colors[tone], chipBg)).toBeGreaterThanOrEqual(AA_TEXT)
        }
      })

      it("control fills read as boundaries (≥ 3)", () => {
        // Deliberately NOT asserting `border`: the design language keeps borders
        // hairline-decorative (cards, chips and dividers share the token, and a
        // 3:1 border would turn the whole app into a wireframe). Controls are
        // identified by their label + surface tint instead of the outline alone,
        // which is what WCAG 1.4.11 actually requires; the trade-off is recorded
        // in the spec's a11y checklist.
        expect(ratio(Theme.colors.primary, Theme.colors.surface)).toBeGreaterThanOrEqual(AA_LARGE_OR_UI)
        expect(ratio(Theme.colors.danger, Theme.colors.surface)).toBeGreaterThanOrEqual(AA_LARGE_OR_UI)
        expect(ratio(Theme.colors.accent, Theme.colors.surface)).toBeGreaterThanOrEqual(AA_LARGE_OR_UI)
      })

      it("soft fills stay perceptible against their host (≥ 1.05)", () => {
        // The tint is a *redundant hint*: the badge's information is its caption
        // text (AA-asserted above) in the tone colour, and the fill only helps
        // the eye group it. WCAG sets no floor for background decor, and dark
        // mode's AA-compliant alpha (~0.08 — a stronger chip would lift its own
        // background past the caption text) measures ~1.09 against the page; the
        // floor exists to catch a future token swap that makes chips invisible
        // (alpha 0, or a fill equal to its host), not to enforce a design.
        for (const soft of ["primarySoft", "accentSoft", "dangerSoft", "successSoft", "warningSoft"] as const) {
          expect(ratio(over(Theme.colors[soft], Theme.colors.background), Theme.colors.background)).toBeGreaterThanOrEqual(1.05)
        }
      })
    })
  },
)

// Guard rails on the derivation itself: soft tokens are rgba strings (the test
// composites them), and a future token swap must not silently become opaque.
describe("soft tokens", () => {
  it("are alpha colours, so the composite maths above is meaningful", () => {
    applyAppearance({ mode: "dark", accent: "ember" })
    for (const soft of ["primarySoft", "accentSoft", "dangerSoft", "successSoft", "warningSoft"] as const) {
      expect(Theme.colors[soft]).toMatch(/^rgba\(/)
    }
    // colorWithOpacity is the only supported producer — a hex soft token would
    // make `over()` return it unchanged and hide a regression.
    expect(colorWithOpacity("#2DD4BF", 0.16)).toMatch(/^rgba\(/)
  })
})

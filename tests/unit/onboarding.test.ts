import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { EDITOR_TOUR, ONBOARDING_SLIDES, READER_TOUR } from "@/libs/onboarding"

/**
 * The onboarding copy is referenced dynamically (`t(slide.titleKey)`), so the
 * static-key guard in `i18n.test.ts` cannot see it. These tests close that gap:
 * every key the carousel and the tour hints resolve must exist in both bundles,
 * and the slide list must stay short enough to swipe through.
 */

const read = (locale: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(process.cwd(), "locales", locale), "utf8")) as Record<
    string,
    unknown
  >

const en = read("en.json")
const es = read("es.json")

const lookup = (bundle: Record<string, unknown>, key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined,
      bundle,
    )

const stepKeys = (steps: { titleKey: string; bodyKey: string }[]): string[] =>
  steps.flatMap((step) => [step.titleKey, step.bodyKey])

const REFERENCED_KEYS = [
  "onboarding.skip",
  "onboarding.next",
  "onboarding.startTour",
  "onboarding.exploreOnMyOwn",
  "onboarding.tourStep",
  "onboarding.tourNext",
  "onboarding.tourSkip",
  "onboarding.tourOpenEditor",
  "onboarding.tourFinish",
  ...ONBOARDING_SLIDES.flatMap((slide) => [slide.titleKey, slide.bodyKey]),
  ...stepKeys(READER_TOUR),
  ...stepKeys(EDITOR_TOUR),
]

describe("guided onboarding", () => {
  it("keeps the welcome to three or four slides", () => {
    expect(ONBOARDING_SLIDES.length).toBeGreaterThanOrEqual(3)
    expect(ONBOARDING_SLIDES.length).toBeLessThanOrEqual(4)
  })

  it("uses every slide illustration exactly once", () => {
    const icons = ONBOARDING_SLIDES.map((slide) => slide.icon)
    expect(new Set(icons).size).toBe(icons.length)
  })

  it("walks the reader and the editor", () => {
    expect(READER_TOUR.length).toBeGreaterThan(0)
    expect(EDITOR_TOUR.length).toBeGreaterThan(0)
  })

  it("resolves every key against both locale bundles", () => {
    expect(REFERENCED_KEYS.length).toBeGreaterThan(0)
    for (const key of REFERENCED_KEYS) {
      expect(typeof lookup(en, key), `en: ${key}`).toBe("string")
      expect(typeof lookup(es, key), `es: ${key}`).toBe("string")
    }
  })
})

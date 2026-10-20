import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Translation guards.
 *
 * Every bundle must stay structurally identical to the English one and every
 * statically referenced key must exist in it, so a screen can never render a
 * raw key. Dynamic keys (template literals such as `performances.${status}`)
 * cannot be checked here and are covered by their interpolating screens.
 *
 * The parity check is **generalised over every shipped language** (roadmap
 * #70): a new bundle is a one-line addition here, and nothing else in the
 * suite has to change to cover it. The placeholder check matters as much as
 * the key check — a translator who drops `{{duration}}` does not break the
 * build, they silently make the value disappear at runtime.
 */

const ROOT = process.cwd()
const SOURCE_DIRS = ["app", "components", "hooks", "libs", "services"]

/** The English bundle is the source of truth; every other one mirrors it. */
const bundles: Record<string, Record<string, unknown>> = {
  en: read("en.json"),
  es: read("es.json"),
  "pt-BR": read("pt-BR.json"),
  fr: read("fr.json"),
}

function read(name: string): Record<string, unknown> {
  const path = join(ROOT, "locales", name)
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>
}

const flatten = (value: Record<string, unknown>, prefix = ""): string[] =>
  Object.entries(value).flatMap(([key, entry]) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? flatten(entry as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )

/** The value behind a dotted path, or `undefined` when the key is absent. */
const valueAt = (bundle: Record<string, unknown>, key: string): unknown =>
  key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[part]
  }, bundle)

/** Every `{{placeholder}}` a value carries, sorted so the order cannot matter. */
const placeholders = (value: unknown): string[] =>
  typeof value === "string"
    ? (value.match(/{{\s*[\w.]+\s*}}/g) ?? []).map((token) => token.replace(/\s/g, "")).sort()
    : []

const walk = (dir: string): string[] => {
  const entries: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) entries.push(...walk(full))
    else if (/\.(t|j)sx?$/.test(name)) entries.push(full)
  }
  return entries
}

const staticKeys = (): string[] => {
  const keys = new Set<string>()
  for (const dir of SOURCE_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const source = readFileSync(file, "utf8")
      for (const match of source.matchAll(/\bt\(\s*["']([A-Za-z][\w.]*)["']/g)) {
        keys.add(match[1] ?? "")
      }
    }
  }
  return [...keys]
}

describe("translations", () => {
  it.each(Object.keys(bundles))("keeps %s structurally identical to English", (language) => {
    const bundle = bundles[language]!
    const enKeys = new Set(flatten(bundles.en!))
    const keys = new Set(flatten(bundle))
    const missing = [...enKeys].filter((key) => !keys.has(key))
    const extra = [...keys].filter((key) => !enKeys.has(key))
    expect(missing, `Missing in ${language}.json: ${missing.join(", ")}`).toEqual([])
    expect(extra, `Extra in ${language}.json: ${extra.join(", ")}`).toEqual([])
  })

  it.each(Object.keys(bundles))("keeps the placeholders of %s", (language) => {
    const bundle = bundles[language]!
    const broken = flatten(bundles.en!).filter((key) => {
      const expected = placeholders(valueAt(bundles.en!, key))
      const actual = placeholders(valueAt(bundle, key))
      return expected.join(",") !== actual.join(",")
    })
    expect(broken, `Placeholders changed in ${language}.json: ${broken.join(", ")}`).toEqual([])
  })

  it("references only keys that exist in English", () => {
    const enKeys = new Set(flatten(bundles.en!))
    // `t("x", { count })` resolves to `x_one`/`x_other`, so those count too.
    const unknown = staticKeys().filter(
      (key) => !enKeys.has(key) && !enKeys.has(`${key}_one`) && !enKeys.has(`${key}_other`),
    )
    expect(unknown, `Unknown keys: ${unknown.join(", ")}`).toEqual([])
  })
})

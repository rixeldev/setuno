import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Translation guards.
 *
 * Both bundles must stay structurally identical and every statically referenced
 * key must exist in the English bundle, so a screen can never render a raw key.
 * Dynamic keys (template literals such as `performances.${status}`) cannot be
 * checked here and are covered by their interpolating screens.
 */

const ROOT = process.cwd()
const SOURCE_DIRS = ["app", "components", "hooks", "libs", "services"]

const read = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>

const en = read(join(ROOT, "locales", "en.json"))
const es = read(join(ROOT, "locales", "es.json"))

const flatten = (value: Record<string, unknown>, prefix = ""): string[] =>
  Object.entries(value).flatMap(([key, entry]) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? flatten(entry as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )

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
  it("keeps en and es structurally identical", () => {
    const enKeys = new Set(flatten(en))
    const esKeys = new Set(flatten(es))
    const missingInEs = [...enKeys].filter((key) => !esKeys.has(key))
    const missingInEn = [...esKeys].filter((key) => !enKeys.has(key))
    expect(missingInEs, `Missing in es.json: ${missingInEs.join(", ")}`).toEqual([])
    expect(missingInEn, `Missing in en.json: ${missingInEn.join(", ")}`).toEqual([])
  })

  it("references only keys that exist in English", () => {
    const enKeys = new Set(flatten(en))
    // `t("x", { count })` resolves to `x_one`/`x_other`, so those count too.
    const unknown = staticKeys().filter(
      (key) => !enKeys.has(key) && !enKeys.has(`${key}_one`) && !enKeys.has(`${key}_other`),
    )
    expect(unknown, `Unknown keys: ${unknown.join(", ")}`).toEqual([])
  })
})

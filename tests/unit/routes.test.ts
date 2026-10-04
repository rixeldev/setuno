import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Structural guards for the Expo Router tree. These catch the two mistakes that
 * are invisible until the app is opened on a device: a navigation entry pointing
 * at a screen that does not exist, and a route module without a default export
 * (which Expo Router rejects at build time).
 *
 * `libs/navigation.ts` imports React Native components, so it is read as source
 * rather than imported.
 */

const APP_DIR = join(process.cwd(), "app")
const APP_GROUP = join(APP_DIR, "(app)")
const NAV_SOURCE = join(process.cwd(), "libs", "navigation.ts")

const walk = (dir: string): string[] => {
  const entries: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) entries.push(...walk(full))
    else if (/\.(t|j)sx?$/.test(name)) entries.push(full)
  }
  return entries
}

/** `/songs` -> app/(app)/songs/index.tsx or app/(app)/songs.tsx */
const routeFileFor = (href: string): string[] => {
  const relative = href.replace(/^\//, "")
  const base = relative.length === 0 ? APP_GROUP : join(APP_GROUP, relative)
  return [`${base}.tsx`, join(base, "index.tsx")]
}

const navHrefs = (): string[] => {
  const source = readFileSync(NAV_SOURCE, "utf8")
  return Array.from(source.matchAll(/href:\s*"([^"]+)"/g), (match) => match[1] ?? "")
}

describe("navigation registry", () => {
  it("has entries to check", () => {
    expect(navHrefs().length).toBeGreaterThan(0)
  })

  it.each(navHrefs())("points at an existing screen: %s", (href) => {
    const candidates = routeFileFor(href)
    expect(
      candidates.some((file) => existsSync(file)),
      `No route file for "${href}" (looked for ${candidates.join(" and ")})`,
    ).toBe(true)
  })

  it("only links to screens inside the (app) group", () => {
    // The auth screens live in their own group and must not appear in the nav.
    for (const href of navHrefs()) {
      expect(href.startsWith("/(auth)")).toBe(false)
      expect(href.startsWith("/")).toBe(true)
    }
  })
})

describe("route modules", () => {
  it("has an app directory", () => {
    expect(existsSync(APP_DIR)).toBe(true)
  })

  it.each(walk(APP_DIR).map((file) => [file.slice(process.cwd().length + 1), file] as const))(
    "exports a default screen: %s",
    (_label, file) => {
      const source = readFileSync(file, "utf8")
      expect(source).toMatch(/export\s+default\b/)
    },
  )
})
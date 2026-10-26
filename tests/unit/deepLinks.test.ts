import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  DEEP_LINK_PATHS,
  buildSetlistLink,
  buildSongLink,
  deepLinkRoute,
} from "@/libs/deepLinks"

/**
 * Deep links and App Links (roadmap #76): the public link shapes, the routes
 * behind them, and the one source of truth the native config and the web
 * deploy both read.
 */

const ROOT = process.cwd()
const config = JSON.parse(readFileSync(join(ROOT, "app-links.json"), "utf8")) as {
  packageName: string
  bundleId: string
  hosts: string[]
  paths: string[]
  sha256Fingerprints: string[]
}

describe("deep links", () => {
  it("builds a song link on the public shape", () => {
    expect(buildSongLink("https://setuno.app", "abc123")).toBe(
      "https://setuno.app/song/abc123",
    )
  })

  it("builds a setlist link on the public shape", () => {
    expect(buildSetlistLink("https://setuno.app", "abc123")).toBe(
      "https://setuno.app/setlist/abc123",
    )
  })

  it("tolerates trailing slashes on the base address", () => {
    expect(buildSongLink("https://setuno.vercel.app///", "abc")).toBe(
      "https://setuno.vercel.app/song/abc",
    )
  })

  it("escapes an id that would break the path", () => {
    expect(buildSongLink("https://setuno.app", "a/b?c")).toBe(
      "https://setuno.app/song/a%2Fb%3Fc",
    )
  })

  it("resolves each shape to the app's own route", () => {
    expect(deepLinkRoute("/song/abc")).toBe("/songs/abc")
    expect(deepLinkRoute("/setlist/abc")).toBe("/setlists/abc")
    expect(deepLinkRoute("/share/tok-1")).toBe("/share/tok-1")
    expect(deepLinkRoute("/join/tok-1")).toBe("/join/tok-1")
  })

  it("ignores a path that only looks like a shape", () => {
    expect(deepLinkRoute("/songbook/abc")).toBeNull()
    expect(deepLinkRoute("/songs/abc")).toBeNull()
    expect(deepLinkRoute("/song")).toBeNull()
    expect(deepLinkRoute("/song/")).toBeNull()
    expect(deepLinkRoute("/")).toBeNull()
    expect(deepLinkRoute("")).toBeNull()
  })

  it("keeps the query out of the route", () => {
    expect(deepLinkRoute("/share/tok-1?from=band")).toBe("/share/tok-1")
  })
})

describe("the app-links config", () => {
  it("claims exactly the public shapes the app publishes", () => {
    expect(config.paths).toEqual(DEEP_LINK_PATHS.map((shape) => `/${shape}`))
  })

  it("claims real https hosts", () => {
    expect(config.hosts.length).toBeGreaterThan(0)
    for (const host of config.hosts) {
      expect(host).toMatch(/^[a-z0-9.-]+$/)
      expect(host).not.toContain("/")
    }
  })

  it("names the app the asset links file claims", () => {
    expect(config.packageName).toBe("com.rixeldev.setuno")
    expect(config.bundleId).toBe("com.rixeldev.setuno")
  })

  it("is the file the native config reads", () => {
    // The intent filter and the served `assetlinks.json` must come from one
    // source, or a host the app claims could stop being a host the deploy
    // serves — and the link would fall back to the browser with no warning.
    const appConfig = readFileSync(join(ROOT, "app.config.js"), "utf8")
    expect(appConfig).toContain("app-links.json")
    expect(appConfig).toContain("appLinks.hosts")
    expect(appConfig).toContain("appLinks.paths")
  })
})

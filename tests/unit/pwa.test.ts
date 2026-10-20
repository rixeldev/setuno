import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import vm from "node:vm"

import { describe, expect, it } from "vitest"

/**
 * The installable web app (roadmap #77): the manifest, the icons and the
 * service worker.
 *
 * The worker is the interesting one, so it is **run** here — with stubbed
 * `caches` and `fetch` — instead of being read as text: the whole point of
 * the design is that it never touches the API, and only a real event proves
 * that.
 */

const ROOT = process.cwd()
const PUBLIC_DIR = join(ROOT, "public")

const manifest = JSON.parse(readFileSync(join(PUBLIC_DIR, "manifest.json"), "utf8")) as {
  name: string
  short_name: string
  start_url: string
  scope: string
  display: string
  background_color: string
  theme_color: string
  icons: { src: string; sizes: string; purpose?: string }[]
}

interface FetchEvent {
  request: { method: string; mode: string; url: string }
  respondWith: (value: unknown) => void
  waited?: unknown
}

interface WorkerScope {
  addEventListener: (type: string, handler: (event: FetchEvent) => void) => void
  skipWaiting: () => Promise<void>
  clients: { claim: () => Promise<void> }
  location: { origin: string }
  caches: {
    open: (name: string) => Promise<{ put: (request: unknown, response: unknown) => void }>
    keys: () => Promise<string[]>
    match: (request: unknown) => Promise<unknown>
    delete: (name: string) => Promise<boolean>
  }
  fetch: (request: unknown) => Promise<unknown>
}

/** Runs the real worker file against stubbed browser APIs. */
const runWorker = () => {
  const source = readFileSync(join(PUBLIC_DIR, "sw.js"), "utf8")
  const listeners: Record<string, (event: FetchEvent) => void> = {}
  const cached = new Map<string, unknown>()
  const scope: WorkerScope = {
    addEventListener: (type, handler) => {
      listeners[type] = handler
    },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
    location: { origin: "https://setuno.vercel.app" },
    caches: {
      open: () => Promise.resolve({ put: (request, response) => cached.set(String(request), response) }),
      keys: () => Promise.resolve([]),
      match: (request) => Promise.resolve(cached.get(String(request)) ?? null),
      delete: () => Promise.resolve(true),
    },
    fetch: () => Promise.resolve({ ok: true, clone: () => ({ ok: true }) }),
  }
  const context = vm.createContext({
    self: scope,
    // The worker uses the bare browser globals, not `self.caches`.
    caches: scope.caches,
    fetch: scope.fetch,
    URL,
    Response,
    Promise,
    console,
  })
  vm.runInContext(source, context)
  return { listeners, scope, cached }
}

/** Fires a fetch event and reports whether the worker answered it. */
const fire = (
  listeners: Record<string, (event: FetchEvent) => void>,
  request: { method: string; mode: string; url: string },
) => {
  let answered = false
  const event: FetchEvent = {
    request,
    respondWith: () => {
      answered = true
    },
  }
  listeners.fetch?.(event)
  return answered
}

describe("the web app manifest", () => {
  it("describes an installable app", () => {
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.start_url).toBe("/")
    expect(manifest.scope).toBe("/")
    expect(manifest.display).toBe("standalone")
    expect(manifest.background_color).toBeTruthy()
    expect(manifest.theme_color).toBeTruthy()
  })

  it("ships the icon sizes a home screen asks for", () => {
    const sizes = manifest.icons.map((icon) => icon.sizes)
    expect(sizes).toContain("192x192")
    expect(sizes).toContain("512x512")
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true)
  })

  it("points at icons that exist", () => {
    for (const icon of manifest.icons) {
      expect(existsSync(join(PUBLIC_DIR, icon.src.replace(/^\//, ""))), icon.src).toBe(true)
    }
  })
})

describe("the web shell", () => {
  const html = readFileSync(join(PUBLIC_DIR, "index.html"), "utf8")

  it("links the manifest and the apple icon", () => {
    expect(html).toContain('rel="manifest"')
    expect(html).toContain('href="/manifest.json"')
    expect(html).toContain('rel="apple-touch-icon"')
  })

  it("registers the service worker", () => {
    expect(html).toContain('navigator.serviceWorker.register("/sw.js")')
  })
})

describe("the service worker", () => {
  it("answers a navigation with the network first", () => {
    const { listeners } = runWorker()
    const answered = fire(listeners, {
      method: "GET",
      mode: "navigate",
      url: "https://setuno.vercel.app/songs/abc",
    })
    expect(answered).toBe(true)
  })

  it("never answers for the API, so the offline writes stay intact", () => {
    const { listeners } = runWorker()
    expect(
      fire(listeners, {
        method: "GET",
        mode: "cors",
        url: "https://firestore.googleapis.com/v1/projects/setuno-be01d/databases/(default)/documents",
      }),
    ).toBe(false)
    expect(
      fire(listeners, {
        method: "GET",
        mode: "cors",
        url: "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=x",
      }),
    ).toBe(false)
  })

  it("never answers a write", () => {
    const { listeners } = runWorker()
    expect(
      fire(listeners, {
        method: "POST",
        mode: "cors",
        url: "https://setuno.vercel.app/anything",
      }),
    ).toBe(false)
  })

  it("caches the hashed static assets", () => {
    const { listeners } = runWorker()
    expect(
      fire(listeners, {
        method: "GET",
        mode: "no-cors",
        url: "https://setuno.vercel.app/_expo/static/js/web/entry-abc123.js",
      }),
    ).toBe(true)
  })
})

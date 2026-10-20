/*
 * The service worker of the installable web app (roadmap #77).
 *
 * What it does, and — just as important — what it does not:
 *
 *   • It caches the **shell** (the HTML) and the **hashed** static assets, so
 *     the app opens offline and launches from the home screen like a native
 *     one. The bundle's file name carries a content hash, so a cached asset
 *     can never be stale: a new deploy simply means a new file.
 *   • It never touches the **API**. The app's offline writes live in
 *     Firestore's own IndexedDB cache, and a service worker that cached or
 *     replayed API responses would corrupt that queue. Everything that is not
 *     this origin is handed straight back to the browser.
 *   * Navigations are **network first**: a fresh shell whenever the network
 *     answers, and the cached one only when it does not. A cached-first shell
 *     would keep an old bundle alive for as long as the cache did.
 */

const CACHE = "setuno-v1"
const SHELL = "/index.html"

/** The static assets Expo emits: the bundle, the fonts and the images. */
const isStatic = (pathname) =>
  pathname.startsWith("/_expo/static/") ||
  pathname.startsWith("/assets/") ||
  pathname.startsWith("/icons/")

self.addEventListener("install", (event) => {
  // Take over as soon as the new worker is ready: the app is a single page
  // and a half-updated shell is worse than a slightly late one.
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)
  // Another origin is the API (Firestore, Auth, Functions): never ours.
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(SHELL).then((cached) => cached ?? Response.error()),
      ),
    )
    return
  }

  if (!isStatic(url.pathname)) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        // Only a real response is worth keeping.
        if (response.ok) {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})

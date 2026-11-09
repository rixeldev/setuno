import { useSyncExternalStore } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

const supported = (): boolean =>
  typeof globalThis.matchMedia === "function" &&
  typeof globalThis.matchMedia(QUERY).addEventListener === "function"

const subscribe = (onChange: () => void): (() => void) => {
  if (!supported()) return () => undefined
  const media = globalThis.matchMedia(QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

const getSnapshot = (): boolean =>
  typeof globalThis.matchMedia === "function" && globalThis.matchMedia(QUERY).matches

/**
 * The browser's `prefers-reduced-motion` media query, read through
 * `useSyncExternalStore` so the value is available on the first paint and stays
 * live when the visitor flips it in their OS (the hydration snapshot is `false`
 * because the export renders on the server, where no browser exists).
 */
export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

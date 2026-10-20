/**
 * Deep links and App Links (roadmap #76). Pure — no React Native imports, so
 * the unit suite can check it in node.
 *
 * The app answers on three **public URL shapes**, all served by the web
 * deploy:
 *
 *   /song/<id>      a song in the band
 *   /setlist/<id>   a setlist in the band
 *   /share/<token>  the public snapshot #56 mints
 *
 * The first two are the app's own screens under stable, public names: a member
 * sends `/song/abc` to a bandmate and the link opens the app when it is
 * installed (Android App Links / iOS Universal Links), or the web app when it
 * is not. The names never move with the app's internal routing, which is why
 * they are not the app's own `/songs/<id>` route — but that route is what the
 * shape resolves to.
 *
 * The hosts and the claimed paths live in `app-links.json` (the single source
 * of truth read by `app.config.js` and `scripts/generate-app-links.mjs`); the
 * app itself never needs them, because an incoming link's path *is* the route.
 */

/** The public link shapes, in the order the app lists them. */
export const DEEP_LINK_PATHS = ["song", "setlist", "share"] as const

export type DeepLinkShape = (typeof DEEP_LINK_PATHS)[number]

/** The app's own route behind each public shape. */
const ROUTE_BY_SHAPE: Record<DeepLinkShape, string> = {
  song: "songs",
  setlist: "setlists",
  share: "share",
}

const isShape = (value: string): value is DeepLinkShape =>
  (DEEP_LINK_PATHS as readonly string[]).includes(value)

/** Trims the trailing slashes a pasted base URL may carry. */
const base = (baseUrl: string): string => baseUrl.replace(/\/+$/, "")

/** `https://setuno.app/song/abc` — a link to a song in the band. */
export const buildSongLink = (baseUrl: string, songId: string): string =>
  `${base(baseUrl)}/song/${encodeURIComponent(songId)}`

/** `https://setuno.app/setlist/abc` — a link to a setlist in the band. */
export const buildSetlistLink = (baseUrl: string, setlistId: string): string =>
  `${base(baseUrl)}/setlist/${encodeURIComponent(setlistId)}`

/**
 * The app route a public deep link resolves to: `/song/abc` → `/songs/abc`,
 * `/setlist/abc` → `/setlists/abc`, `/share/tok` → `/share/tok`.
 *
 * `null` for anything else — a foreign path, a shape without an id, or a path
 * that only looks like one (`/songbook/abc` is not a song).
 */
export const deepLinkRoute = (path: string): string | null => {
  const match = /^\/(song|setlist|share)\/([^/?#]+)/.exec(path)
  if (!match) return null
  const shape = match[1] ?? ""
  const id = match[2] ?? ""
  if (!isShape(shape) || id.length === 0) return null
  return `/${ROUTE_BY_SHAPE[shape]}/${id}`
}

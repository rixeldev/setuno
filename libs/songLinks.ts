import {
  EMPTY_SONG_LINKS,
  type SongLinkProvider,
  type SongLinks,
} from "@/interfaces/song"

/** Providers in the order the editor and the reader present them (#16). */
export const SONG_LINK_PROVIDERS: SongLinkProvider[] = ["youtube", "spotify", "appleMusic"]

/**
 * Cleans up a pasted link so only a real web address is ever stored or opened.
 *
 * A bare `youtube.com/…` gains the `https://` scheme; anything that is not a
 * web link (an empty field, or an unsafe scheme such as `javascript:`) is
 * dropped. Keeping this pure means the same rule guards the editor, the write
 * to Firestore and the render.
 */
export const normalizeSongLink = (raw: unknown): string => {
  if (typeof raw !== "string") return ""
  const value = raw.trim()
  if (value.length === 0) return ""
  if (/^https?:\/\//i.test(value)) return value
  // Only http(s) links are opened: refuse every other explicit scheme.
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return ""
  return `https://${value}`
}

/** Reads a stored links map, filling every provider and dropping junk values. */
export const normalizeSongLinks = (raw: unknown): SongLinks => {
  const source = (raw ?? {}) as Partial<Record<SongLinkProvider, unknown>>
  const links: SongLinks = { ...EMPTY_SONG_LINKS }
  for (const provider of SONG_LINK_PROVIDERS) {
    links[provider] = normalizeSongLink(source[provider])
  }
  return links
}

/** True when no provider has a link, so the reader can hide the whole block. */
export const isEmptySongLinks = (links: SongLinks | null | undefined): boolean =>
  SONG_LINK_PROVIDERS.every((provider) => normalizeSongLink(links?.[provider]).length === 0)

/**
 * The links that are actually set, in display order — exactly what the reader
 * iterates to render a button per provider.
 */
export const songLinkEntries = (
  links: SongLinks | null | undefined,
): { provider: SongLinkProvider; url: string }[] =>
  SONG_LINK_PROVIDERS.map((provider) => ({
    provider,
    url: normalizeSongLink(links?.[provider]),
  })).filter((entry) => entry.url.length > 0)

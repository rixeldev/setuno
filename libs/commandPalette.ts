import type { ComponentType } from "react"

/**
 * Command palette (roadmap #29): the pure half of Ctrl+K.
 *
 * Nothing here touches React, the DOM or the platform, so the ranking is
 * unit-tested in `tests/unit/commandPalette.test.ts` — a palette is only as
 * good as its first row, and "the best match" has to mean the same thing on
 * every machine.
 */

export interface PaletteCommand {
  /** Stable identity: the React key and the registry slot. */
  id: string
  /** Already-translated label — the palette never calls `t` on a command. */
  title: string
  /** Already-translated heading its results bucket under. */
  group: string
  /** Extra words that should match the query but are never shown. */
  keywords?: readonly string[]
  /** Right-aligned hint: a shortcut, a current value, a count. */
  hint?: string
  /** Leading glyph, for the destinations that carry one in the navigation. */
  icon?: ComponentType<{ size?: number; color?: string }>
  run: () => void
}

/** Anything the ranking can score: a command, a song, a member. */
export interface Searchable {
  text: string
  keywords?: readonly string[]
}

const SCORE_CHAR = 1
const SCORE_CONSECUTIVE = 4
const SCORE_WORD_START = 6
const SCORE_WORD = 12
const SCORE_PREFIX = 20
const SCORE_EXACT = 40
/** A hit in `keywords` counts, but never as much as one in the title. */
const KEYWORD_FACTOR = 0.6

/** Characters that end a word for scoring purposes. */
const WORD_BOUNDARY = /[\s/\\\-_.,:;|()[\]{}]/

/**
 * Latin-friendly fold: "Ámbar" has to match "ambar" and vice versa, because
 * the app is bilingual and nobody types accents when they are in a hurry.
 */
export const foldText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

/**
 * The query as the matcher sees it: folded and with its runs of whitespace
 * collapsed, so a double space pasted from somewhere is still the same query.
 * Spaces are matched like any other character — "new s" still finds
 * "New song" through the subsequence walk, it simply scores below "new song".
 */
export const foldQuery = (value: string): string => foldText(value).replace(/\s+/g, " ").trim()

/**
 * Score of `query` inside `text`, or `null` when the query is not a
 * subsequence of it at all.
 *
 * The walk is left to right (so the score favours what you typed appearing
 * early), and it rewards the two things that make a match feel right:
 * characters that follow each other, and characters that start a word — which
 * is what lets "ns" or "so" surface "New song" at all. A whole-word, prefix or
 * exact hit then jumps clear of the pack.
 */
export const matchScore = (query: string, text: string): number | null => {
  const needle = foldQuery(query)
  const haystack = foldText(text)
  if (needle.length === 0) return 0
  if (needle.length > haystack.length) return null

  let score = 0
  let cursor = 0
  let previousIndex = -1
  for (const character of needle) {
    const index = haystack.indexOf(character, cursor)
    if (index === -1) return null
    if (index === previousIndex + 1) score += SCORE_CONSECUTIVE
    if (index === 0 || WORD_BOUNDARY.test(haystack[index - 1] ?? "")) score += SCORE_WORD_START
    score += SCORE_CHAR
    previousIndex = index
    cursor = index + 1
  }

  if (haystack === needle) score += SCORE_EXACT
  else if (haystack.startsWith(needle)) score += SCORE_PREFIX
  else if (haystack.split(WORD_BOUNDARY).includes(needle)) score += SCORE_WORD

  return score
}

/**
 * Best score of `query` against one item: its text, or its keywords if none of
 * them beats it. `null` means "this item does not match".
 */
export const itemScore = (query: string, item: Searchable): number | null => {
  if (query.length === 0) return 0
  const direct = matchScore(query, item.text)
  let best = direct
  for (const keyword of item.keywords ?? []) {
    const score = matchScore(query, keyword)
    if (score === null) continue
    const discounted = Math.round(score * KEYWORD_FACTOR)
    if (best === null || discounted > best) best = discounted
  }
  return best
}

/**
 * The items worth showing, best first, at most `limit` of them.
 *
 * An empty query keeps the caller's order untouched: that is how the palette
 * opens, and navigation has to stay in navigation order there rather than
 * turning into an alphabetical list. Ties fall back to the text, so the same
 * query can never shuffle between renders.
 */
export const rankSearchable = <T extends Searchable>(
  items: readonly T[],
  query: string,
  limit: number,
): T[] => {
  const needle = foldQuery(query)
  if (needle.length === 0) return items.slice(0, limit)

  const scored: { item: T; score: number }[] = []
  for (const item of items) {
    const score = itemScore(needle, item)
    if (score !== null) scored.push({ item, score })
  }
  scored.sort((a, b) => b.score - a.score || a.item.text.localeCompare(b.item.text))
  return scored.slice(0, limit).map((entry) => entry.item)
}

/**
 * Commands the screen you are on contributes while it is mounted — the
 * reader's transpose, for instance.
 *
 * A plain module map, deliberately: commands are only read when the palette
 * opens, and registering from an effect costs no re-render. A React context
 * would force every caller into a registration state machine to publish a
 * handful of closures that nothing renders.
 */
const registry = new Map<string, PaletteCommand[]>()

export const registerPaletteCommands = (owner: string, commands: readonly PaletteCommand[]): void => {
  registry.set(owner, [...commands])
}

export const unregisterPaletteCommands = (owner: string): void => {
  registry.delete(owner)
}

/** Everything the open screens have registered, in no particular order. */
export const registeredPaletteCommands = (): PaletteCommand[] => {
  const all: PaletteCommand[] = []
  for (const commands of registry.values()) all.push(...commands)
  return all
}

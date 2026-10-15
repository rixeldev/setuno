import type { SetlistBlock, SetlistSong } from "@/interfaces/setlist"
import { createId } from "@/libs/songUtils"

/** Longest a divider name gets before it is cut — a label, not a paragraph. */
export const MAX_BLOCK_NAME = 40

/** Longest a per-entry note gets before it is cut — a cue, not a comment. */
export const MAX_SONG_NOTE = 200

/**
 * One rendered row of a setlist (roadmap #43): either a song, with the position
 * it holds in the running order, or the divider that sits after the song it is
 * anchored to.
 */
export type SetlistRow =
  | { kind: "song"; order: number; entry: SetlistSong }
  | { kind: "block"; block: SetlistBlock }

/**
 * The running order as it reads, dividers interleaved with their music.
 *
 * A block is anchored **after a song** (`afterSongId`, `null` = the very top),
 * never to a position: reordering songs then carries every divider along with
 * the music it belongs to, and no index arithmetic is ever needed. Anchoring
 * "after" rather than "before" is what makes all the gaps reachable — the top,
 * any gap between two songs, and the bottom after the last song — which a
 * "before" anchor cannot express (it would duplicate the top and lose the end).
 *
 * Blocks whose song has left the list are **kept and rendered after the last
 * song**: they are data the band wrote, so they stay visible and removable
 * instead of vanishing behind a rename.
 */
export const listRows = (
  songs: readonly SetlistSong[],
  blocks: readonly SetlistBlock[],
): SetlistRow[] => {
  const known = new Set(songs.map((entry) => entry.songId))
  const anchored = new Map<string | null, SetlistBlock[]>()
  const orphans: SetlistBlock[] = []

  const park = (key: string | null, block: SetlistBlock): void => {
    const bucket = anchored.get(key)
    if (bucket) bucket.push(block)
    else anchored.set(key, [block])
  }

  for (const block of blocks) {
    if (block.afterSongId === null) park(null, block)
    else if (known.has(block.afterSongId)) park(block.afterSongId, block)
    else orphans.push(block)
  }

  const rows: SetlistRow[] = (anchored.get(null) ?? []).map((block) => ({
    kind: "block",
    block,
  }))
  songs.forEach((entry, index) => {
    rows.push({ kind: "song", order: index + 1, entry })
    for (const block of anchored.get(entry.songId) ?? []) {
      rows.push({ kind: "block", block })
    }
  })
  for (const block of orphans) rows.push({ kind: "block", block })
  return rows
}

/**
 * Removes a song from the running order and keeps its dividers in the gap the
 * song used to fill: every block anchored to it re-anchors to the song that
 * came *before* it (the top, when it was first), which lands in the same place
 * whether the removed song was first, in the middle or last.
 */
export const removeEntry = (
  songs: readonly SetlistSong[],
  blocks: readonly SetlistBlock[],
  songId: string,
): { songs: SetlistSong[]; blocks: SetlistBlock[] } => {
  const index = songs.findIndex((entry) => entry.songId === songId)
  if (index < 0) return { songs: [...songs], blocks: [...blocks] }

  const fallback = index > 0 ? (songs[index - 1]?.songId ?? null) : null
  return {
    songs: songs.filter((entry) => entry.songId !== songId).map((entry) => ({ ...entry })),
    blocks: blocks.map((block) =>
      block.afterSongId === songId ? { ...block, afterSongId: fallback } : block,
    ),
  }
}

/** Appends a divider after `afterSongId` (`null` puts it at the top). */
export const insertBlock = (
  blocks: readonly SetlistBlock[],
  name: string,
  afterSongId: string | null,
): SetlistBlock[] => [
  ...blocks,
  {
    id: createId("blk"),
    name: cleanBlockName(name),
    afterSongId,
  },
]

export const renameBlock = (
  blocks: readonly SetlistBlock[],
  id: string,
  name: string,
): SetlistBlock[] =>
  blocks.map((block) => (block.id === id ? { ...block, name: cleanBlockName(name) } : block))

export const removeBlock = (blocks: readonly SetlistBlock[], id: string): SetlistBlock[] =>
  blocks.filter((block) => block.id !== id)

/** Trimmed and bounded, never empty — an unnamed divider is not a divider. */
export const cleanBlockName = (name: string): string => name.trim().slice(0, MAX_BLOCK_NAME)

/**
 * Hygiene for a list coming from a form or from storage: names trimmed and
 * bounded, unnamed dividers dropped, repeated ids collapsed to their first
 * appearance. Orphaned blocks are deliberately left alone — `listRows` renders
 * them at the end, where the band can see and remove them.
 */
export const cleanBlocks = (blocks: readonly SetlistBlock[]): SetlistBlock[] => {
  const seen = new Set<string>()
  const out: SetlistBlock[] = []
  for (const block of blocks) {
    const name = cleanBlockName(block.name ?? "")
    if (name.length === 0 || seen.has(block.id)) continue
    seen.add(block.id)
    out.push({ id: block.id, name, afterSongId: block.afterSongId ?? null })
  }
  return out
}

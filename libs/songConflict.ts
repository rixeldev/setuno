import type { Song } from "@/interfaces"
import { toMillis } from "@/interfaces/timestamp"

/**
 * The `updatedAt` an editing session was seeded from, in milliseconds — the
 * moment somebody last saved the song before this draft started. `null` means
 * there is nothing to compare against (a document without a usable stamp).
 */
export const songStamp = (song: Song | null | undefined): number | null => toMillis(song?.updatedAt)

/**
 * True when the live song document was saved *after* the editor loaded it
 * (stale-save guard): the subscription has since delivered a different
 * `updatedAt`, so saving now would silently replace that work. A second
 * device of the user's own counts just the same — the warning is about the
 * draft being stale, not about who made it.
 *
 * A stamp that has not resolved yet (a pending `serverTimestamp` reads as
 * `null` on the writing client) reports `false`: never cry conflict on a
 * value we cannot compare.
 */
export const editIsStale = (live: Song | null | undefined, loadedStamp: number | null): boolean => {
  if (loadedStamp === null) return false
  const current = songStamp(live)
  return current !== null && current !== loadedStamp
}

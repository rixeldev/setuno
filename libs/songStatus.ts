import type { Song, SongStatus } from "@/interfaces"

/**
 * The repertoire status of a song (roadmap #30), kept pure so the picker rule
 * and the mapper normalise the same way the tests describe:
 *
 * - `draft` — being written; still pickable, the band may want to try it.
 * - `active` — the default; the lifecycle of an existing document without the
 *   field reads back as active, so #30 needs no migration.
 * - `retired` — kept in the songbook (searchable, openable, printable) but
 *   excluded from setlist pickers by default; it stays in every list it was
 *   already part of.
 */
export const SONG_STATUSES: readonly SongStatus[] = ["draft", "active", "retired"]

export const DEFAULT_SONG_STATUS: SongStatus = "active"

/** The i18n key for each status label (resolved with `t` at the call site). */
export const SONG_STATUS_LABEL_KEYS: Record<SongStatus, string> = {
  draft: "songs.statusDraft",
  active: "songs.statusActive",
  retired: "songs.statusRetired",
}

export const isSongStatus = (value: unknown): value is SongStatus =>
  typeof value === "string" && (SONG_STATUSES as readonly string[]).includes(value)

/** Coerces untrusted data to a known status; anything unknown is active. */
export const normalizeSongStatus = (value: unknown): SongStatus =>
  isSongStatus(value) ? value : DEFAULT_SONG_STATUS

/**
 * Whether a song may be **added** to a setlist through a picker (roadmap #30):
 * retired songs are excluded unless the picker is explicitly showing them.
 * This never removes a song from a list it is already in — the exclusion is a
 * property of adding, not of the data.
 */
export const isPickableForSetlist = (song: Song, includeRetired = false): boolean =>
  includeRetired || song.status !== "retired"

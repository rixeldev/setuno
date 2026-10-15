import type { Song } from "@/interfaces"

/**
 * Trash and recovery (roadmap #31). A trashed song is a **soft** delete: the
 * document stays (with who trashed it and when), every screen derives "gone"
 * from these two helpers, and restoring is a plain nulling of the pair.
 *
 * `useOrgData` partitions the library once — `songs` is what every screen
 * shows, `trashedSongs` is what only the trash view asks for — so "trashed
 * songs are hidden everywhere" cannot drift per call site. The `songLibrary`
 * map deliberately keeps both, so setlists and annotations still resolve a
 * song that is in the trash.
 */
export const isTrashed = (song: Song): boolean => song.deletedAt != null

/** Splits the library into what every screen shows and what only the trash does. */
export const partitionTrashed = (songs: Song[]): { visible: Song[]; trashed: Song[] } => {
  const visible: Song[] = []
  const trashed: Song[] = []
  for (const song of songs) (isTrashed(song) ? trashed : visible).push(song)
  return { visible, trashed }
}

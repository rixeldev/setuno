export interface SetlistStep {
  /** Previous song in the running order, or null at the start. */
  previousId: string | null
  /** Next song in the running order, or null at the end. */
  nextId: string | null
}

/**
 * Step through the running order of one setlist.
 *
 * The reader receives the setlist it was opened from (the setlist screen only
 * passes one for lists attached to an event), so the arrows walk exactly that
 * list — never the general songbook. Returns null when the song is not part of
 * it.
 */
export const setlistStep = (
  songId: string,
  songs: readonly { songId: string }[],
): SetlistStep | null => {
  const index = songs.findIndex((entry) => entry.songId === songId)
  if (index < 0) return null
  return {
    previousId: index > 0 ? songs[index - 1].songId : null,
    nextId: index < songs.length - 1 ? songs[index + 1].songId : null,
  }
}

/**
 * Reader layout helpers.
 *
 * The reader splits the song into two columns on wide screens (roadmap #9).
 * Spreading a short lyric line across two 300 px columns reads worse than a
 * single comfortable one, so the split only happens when each column can hold
 * a real line. Phones and small tablets in landscape therefore stay single
 * column, while wide tablets and desktop keep the two-column flow.
 */

/** Gap between the two reader columns, matching `Theme.spacing.xl`. */
const READER_COLUMN_GAP = 20

/** Minimum width one lyric column needs to be worth splitting the song. */
export const READER_COLUMN_MIN_WIDTH = 320

export const readerColumnCount = (bodyWidth: number): 1 | 2 => {
  if (!Number.isFinite(bodyWidth) || bodyWidth < 0) return 1
  return bodyWidth >= READER_COLUMN_MIN_WIDTH * 2 + READER_COLUMN_GAP ? 2 : 1
}
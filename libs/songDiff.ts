import type { ChordPosition } from "@/interfaces/song"
import { buildChordSegments } from "@/libs/songUtils"

/**
 * The diff engine behind the suggestion review screen (roadmap #54), written as
 * a pure lib so roadmap #26 — song version history — can reuse it for
 * "what changed between these two versions" without importing a component.
 *
 * Nothing here knows about React: it takes text (and the structured chord
 * change a suggestion stores) and returns a list of runs for the renderer to
 * colour. Every function is synchronous, allocation-light and total — a
 * malformed change never throws, it just produces a diff with nothing marked.
 */
export type DiffKind = "same" | "removed" | "added"

export interface DiffSegment {
  kind: DiffKind
  text: string
}

/**
 * Past this many tokens on either side the word diff stops marking runs and
 * reports the whole text as removed then added. The LCS table is quadratic, and
 * #26 will hand this whole sections at a time; a reviewer wants the interesting
 * lines highlighted, not a 400×400 table computed to mark everything anyway.
 */
export const DIFF_TOKEN_LIMIT = 300

/** Words and whitespace runs, so re-indenting does not mark every word. */
const tokenize = (value: string): string[] => value.match(/\S+|\s+/g) ?? []

/** Merges neighbouring runs of one kind, so the renderer needs fewer spans. */
const coalesce = (segments: DiffSegment[]): DiffSegment[] => {
  const out: DiffSegment[] = []
  for (const segment of segments) {
    const last = out[out.length - 1]
    if (last && last.kind === segment.kind) last.text += segment.text
    else out.push({ ...segment })
  }
  return out
}

const plain = (kind: DiffKind, text: string): DiffSegment[] =>
  text.length > 0 ? [{ kind, text }] : []

/**
 * Word-level diff between two strings. Whitespace is kept as its own token, so
 * a line that only moved its indentation does not mark every word on it, and
 * runs of the same kind come back merged.
 */
export const diffWords = (from: string, to: string): DiffSegment[] => {
  const left = tokenize(from)
  const right = tokenize(to)

  if (left.length > DIFF_TOKEN_LIMIT || right.length > DIFF_TOKEN_LIMIT) {
    return [...plain("removed", from), ...plain("added", to)]
  }

  // table[i][j] = length of the longest common subsequence of the tails
  // left[i…] and right[j…]. Built back to front so the walk below can read
  // ahead in constant time.
  const table: number[][] = Array.from({ length: left.length + 1 }, () =>
    new Array<number>(right.length + 1).fill(0),
  )
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }

  const segments: DiffSegment[] = []
  let i = 0
  let j = 0
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      segments.push({ kind: "same", text: left[i] })
      i += 1
      j += 1
    } else if (j < right.length && (i === left.length || table[i][j + 1] > table[i + 1][j])) {
      segments.push({ kind: "added", text: right[j] })
      j += 1
    } else {
      segments.push({ kind: "removed", text: left[i] })
      i += 1
    }
  }
  return coalesce(segments)
}

/** The part of a chord change the diff needs; a subset of `SuggestionChange`. */
export interface ChordChange {
  /** Character offset of the chord inside the lyric line, as suggestions store it. */
  position: number
  /** Chord as it was when the suggestion was written (empty = inserting). */
  from: string
  /** Proposed chord (empty = deleting). */
  to: string
}

/**
 * A chord change rendered inside its own row, so the reviewer sees *where* it
 * lands rather than two chords floating in a box.
 *
 * The grid is rebuilt with the proposed chord in place and only that chord is
 * marked — the surrounding columns keep their padding, which matters because
 * the row is drawn in a monospace font above the lyric line. The chord that is
 * there **now** is struck through before it: what the song actually holds wins
 * over what the suggestion claimed, since the song may have moved on. An
 * insertion (`from` empty) marks only the new chord; a deletion (`to` empty)
 * keeps the chord where it is and marks it, because dropping it from the drawn
 * row would leave the reviewer comparing against a grid that no longer shows
 * what they are being asked to remove. The struck run is today's chord but the
 * padding around it is the proposal's — it sits directly before the marked run,
 * so keeping both rows byte-exact would mean guessing the other's width; what
 * follows the change is always positioned for the chord that would be played.
 *
 * The row is drawn in letters, which is what the review screen shows and what
 * the suggestion itself stores — the reader's notation preference never applies
 * to a proposal, so a segment here is never a solfège label.
 */
export const diffChordLine = (
  line: { chords: ChordPosition[]; text: string },
  change: ChordChange,
): DiffSegment[] => {
  const from = change.from.trim()
  const to = change.to.trim()
  // A change that names no chord on either side changes nothing at all.
  if (from.length === 0 && to.length === 0) {
    return coalesce(
      buildChordSegments(line.chords, line.text).map((segment) => ({
        kind: "same" as const,
        text: segment.text,
      })),
    )
  }

  const existing = line.chords.find((chord) => chord.position === change.position)
  const current = existing ? existing.chord.trim() : from

  // A deletion draws the row as it stands — the chord stays where it is so the
  // reviewer can see what they are being asked to remove. Every other case
  // draws the proposal: the new chord takes the offset, and its neighbours keep
  // their padding.
  const drawn =
    to.length > 0
      ? [
          ...line.chords.filter((chord) => chord.position !== change.position),
          { chord: to, position: change.position },
        ].sort((a, b) => a.position - b.position)
      : line.chords

  const segments: DiffSegment[] = []
  let marked = false
  for (const segment of buildChordSegments(drawn, line.text)) {
    if (segment.position !== change.position || marked) {
      segments.push({ kind: "same", text: segment.text })
      continue
    }
    marked = true
    segments.push(...plain("removed", current))
    segments.push(...plain("added", to))
  }
  return coalesce(segments)
}

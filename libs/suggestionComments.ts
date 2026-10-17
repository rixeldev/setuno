/**
 * Comment threads on a suggestion (roadmap #55) — the pure half: the body a
 * member may actually write. `firestore.rules` pins the same bounds (`body` a
 * string of 1..`COMMENT_MAX_LENGTH` characters and the exact field list),
 * because rules can only reject, never sanitise: trimming here keeps the
 * document clean and clamping here keeps the write inside the rules.
 */

/** Matches `request.resource.data.body.size() <= 1000` in firestore.rules. */
export const COMMENT_MAX_LENGTH = 1000

/**
 * The body as it will be stored: line endings normalised to `\n` and outer
 * whitespace trimmed, `null` when there is nothing to say. Interior spacing —
 * including blank lines between paragraphs — survives on purpose: this is a
 * discussion, not a song line. Past {@link COMMENT_MAX_LENGTH} it is cut to
 * size (a trailing lone surrogate is dropped so the stored string stays a
 * well-formed UTF-16 pair sequence).
 */
export const sanitizeCommentBody = (raw: string): string | null => {
  const trimmed = raw.replace(/\r\n?/g, "\n").trim()
  if (trimmed.length === 0) return null
  if (trimmed.length <= COMMENT_MAX_LENGTH) return trimmed
  const cut = trimmed.slice(0, COMMENT_MAX_LENGTH)
  // An emoji sitting exactly on the cut would leave half a surrogate pair.
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut
}

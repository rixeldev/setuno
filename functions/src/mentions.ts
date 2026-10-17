/**
 * `@mention` parsing for suggestion comments (roadmap #58).
 *
 * Pure on purpose — **zero imports at all**, exactly like `notify.ts`: the
 * trigger that fans a mention out to push notifications and the app's comment
 * composer/renderer both read this module (the app through the `@/functions`
 * tsconfig alias), so the highlight a member sees in a posted comment and the
 * notification their bandmate receives can never be derived by two parsers
 * that disagree.
 *
 * A mention is `@` + one member's display name. Usernames are unique across
 * the app and a band member's `displayName` mirrors their claimed username
 * (the self-heal in `hooks/useOrganization.tsx` keeps it fresh), so handles
 * are roster-constrained: only names the band actually holds can resolve.
 * Names may contain single spaces ("Ann Lee"), so matching is **longest-first
 * against the roster** — "@Ann Lee is singing" mentions Ann Lee, while
 * "@Ann is on guitar" mentions Ann, and "@Annabelle" mentions nobody. The
 * same boundary rule keeps an email address or a longer word from lighting
 * up as a mention.
 */

export interface MentionMember {
  uid: string
  displayName: string
}

/** One run of a comment body: plain text, or a resolved `@handle` (with it). */
export interface MentionSegment {
  text: string
  /** The mentioned member's uid, or `null` for a plain run. */
  uid: string | null
}

/**
 * Comparison key for a handle: trimmed, inner whitespace collapsed, case
 * folded — the same normalization `libs/username.ts#usernameKey` applies to
 * the claim key, inlined here to keep this module import-free.
 */
const mentionKey = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase()

/** Letters and digits in any script: what a handle may not be glued to. */
const isWordChar = (char: string | undefined): boolean =>
  char !== undefined && /[\p{L}\p{N}]/u.test(char)

/**
 * Roster handles by key, longest first so the greedy match prefers the fuller
 * name, first member winning a (theoretical) duplicate display name.
 */
const handleKeys = (members: readonly MentionMember[]): string[] => {
  const keys = new Map<string, true>()
  for (const member of members) {
    const key = mentionKey(member.displayName)
    if (key.length > 0) keys.set(key, true)
  }
  return [...keys.keys()].sort((left, right) => right.length - left.length)
}

const uidOf = (members: readonly MentionMember[], key: string): string | null =>
  members.find((member) => mentionKey(member.displayName) === key)?.uid ?? null

/**
 * Splits a comment body into plain runs and resolved mentions, in order —
 * `segments.map(s => s.text).join("")` is always the original body, so the
 * renderer can highlight in place without rewriting a single character.
 */
export const splitMentions = (
  body: string,
  members: readonly MentionMember[],
): MentionSegment[] => {
  const keys = handleKeys(members)
  const lower = body.toLocaleLowerCase()
  const segments: MentionSegment[] = []
  const push = (text: string, uid: string | null): void => {
    if (text.length === 0) return
    const last = segments[segments.length - 1]
    if (last && last.uid === uid) segments[segments.length - 1] = { text: last.text + text, uid }
    else segments.push({ text, uid })
  }

  let plainStart = 0
  let index = 0
  while (index < body.length) {
    if (body[index] === "@" && !isWordChar(body[index - 1])) {
      const key = keys.find(
        (candidate) =>
          lower.startsWith(candidate, index + 1) &&
          !isWordChar(body[index + 1 + candidate.length]),
      )
      if (key !== undefined) {
        push(body.slice(plainStart, index), null)
        const end = index + 1 + key.length
        push(body.slice(index, end), uidOf(members, key))
        index = end
        plainStart = end
        continue
      }
    }
    index += 1
  }
  push(body.slice(plainStart), null)
  return segments
}

/**
 * The uids a body mentions, deduplicated in order of first appearance. This
 * is what the push trigger sends to — an unknown `@word` is just text, and a
 * repeated handle is one notification, not two.
 */
export const extractMentionUids = (
  body: string,
  members: readonly MentionMember[],
): string[] => {
  const uids = new Set<string>()
  for (const segment of splitMentions(body, members)) {
    if (segment.uid !== null) uids.add(segment.uid)
  }
  return [...uids]
}

/**
 * The composer's insert: appends `@handle ` to the draft, adding the space
 * the previous word needs so the new handle starts where a mention can
 * resolve (never glued to a letter, which is exactly the boundary rule above).
 */
export const appendMention = (draft: string, handle: string): string => {
  const separator = draft.length > 0 && !/\s$/.test(draft) ? " " : ""
  return `${draft}${separator}@${handle} `
}

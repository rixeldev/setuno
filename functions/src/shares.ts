/**
 * Share links (roadmap #56) — the pure core behind the `createShare` /
 * `revokeShare` callables and the payload the public screen renders.
 *
 * Zero firebase imports, not even type-only: the app reads `ShareKind`, the
 * payload shapes and the clamps from this module through the `@/functions`
 * alias (the `notify.ts` precedent), so Metro can never drag firebase-admin
 * into a bundle that imports it.
 *
 * The sanitizers below pin what a share document may contain. Rules cannot
 * inspect a nested payload — the `markers` / `showLog` precedent — and here the
 * document is written by the Admin SDK anyway (no write rule exists at all),
 * so this layer is both the size governor and the shape contract every reader
 * can trust: anything malformed self-heals into an empty-but-valid value
 * instead of reaching a fan's screen.
 */

/** Payload contract version; older documents keep rendering as long as shapes hold. */
export const SHARE_VERSION = 1

export type ShareKind = "song" | "setlist"

/**
 * Expiries the callable accepts, in the order the sheet offers them — `null`
 * is "never expires" and comes first on purpose (a permanent link is the
 * common case; an expiring one is the deliberate choice).
 */
export const SHARE_EXPIRY_DAYS: readonly (number | null)[] = [null, 30, 7]

/** Share tokens are 16 random bytes as base64url — 22 chars, 128 bits. */
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{10,64}$/

/** Serialized payload ceiling, well under Firestore's 1 MiB document limit. */
export const SHARE_PAYLOAD_BYTES_MAX = 900_000

export const SHARE_TITLE_MAX = 300
export const SHARE_ARTIST_MAX = 200
export const SHARE_KEY_MAX = 16
export const SHARE_NOTE_MAX = 300
export const SHARE_LABEL_MAX = 120
export const SHARE_LINE_MAX = 500
export const SHARE_CHORD_MAX = 24
export const SHARE_CHORD_POSITION_MAX = 4_000
export const SHARE_BARS_MAX = 999
export const SHARE_SECTIONS_MAX = 60
export const SHARE_LINES_MAX = 200
export const SHARE_CHORDS_MAX = 60
export const SHARE_ENTRIES_MAX = 100
export const SHARE_DIVIDERS_MAX = 40

export interface SharedChord {
  chord: string
  position: number
}

export interface SharedLine {
  text: string
  chords: SharedChord[]
}

export interface SharedSection {
  id: string
  /**
   * Free-form on purpose: the app's own `SongSectionType` union is the single
   * source of truth for what renders (`libs/shareView.ts` validates against
   * `SECTION_TYPES`), so adding a section type here would only create a second
   * place to keep in step. Unknown values degrade to a custom labelled block.
   */
  type: string
  label: string
  /** `null` = unset, mirroring the app's "0 means no bar count" contract. */
  bars: number | null
  lines: SharedLine[]
}

export interface SharedSongPayload {
  artist: string
  key: string
  capo: number
  bpm: number | null
  durationSec: number | null
  sections: SharedSection[]
}

export interface SharedSetlistEntry {
  songId: string
  title: string
  artist: string
  key: string
  note: string
}

export interface SharedDivider {
  name: string
  afterSongId: string | null
}

export interface SharedSetlistPayload {
  /** Event date the list was built for (`yyyy-mm-dd`), when it had one. */
  date: string | null
  entries: SharedSetlistEntry[]
  dividers: SharedDivider[]
}

export interface SharedPayloadByKind {
  song: SharedSongPayload
  setlist: SharedSetlistPayload
}

/**
 * The "current position" a band's own clients keep fresh on a share document
 * while the show runs (roadmap #57). Never written by the callables: the
 * rules' member carve-out on `shares/{token}` allows updating **this field
 * only**, and the public screen reads it through a document listener — the
 * same `get` rule serves a single-document listener, so `list` stays closed.
 * Absent (or null) = the link is a plain static snapshot, exactly as #56
 * shipped it.
 */
export interface ShareLive {
  songId: string
  /** 1-based position within the shared setlist's entries. */
  position: number
  /** Epoch ms of the last position write — client time, offline-safe. */
  updatedAt: number
}

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : ""

const integer = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.trunc(value)))
    : fallback

const nullableInteger = (value: unknown, min: number, max: number): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? Math.trunc(value)
    : null

const asArray = (value: unknown, max: number): unknown[] =>
  Array.isArray(value) ? value.slice(0, max) : []

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

/** Share document title (song title or setlist name), clamped. */
export const sanitizeShareTitle = (value: unknown): string => text(value, SHARE_TITLE_MAX)

/**
 * Snapshot of one song as stored — the raw Firestore document. Sections,
 * lines and chords are clamped element by element; a malformed entry never
 * breaks the snapshot, it collapses to an empty line or is dropped.
 */
export const sanitizeSharedSong = (raw: Record<string, unknown>): SharedSongPayload => ({
  artist: text(raw.artist, SHARE_ARTIST_MAX),
  key: text(raw.key, SHARE_KEY_MAX),
  capo: integer(raw.capo, 0, 24, 0),
  bpm: nullableInteger(raw.bpm, 1, 999),
  durationSec: nullableInteger(raw.durationSec, 0, 86_400),
  sections: asArray(raw.sections, SHARE_SECTIONS_MAX).map((entry, index) => {
    const section = asRecord(entry)
    const bars = integer(section.bars, 0, SHARE_BARS_MAX, 0)
    return {
      id: text(section.id, 64) || `sec_${index}`,
      type: text(section.type, 40) || "verse",
      label: text(section.label, SHARE_LABEL_MAX) || "Section",
      bars: bars > 0 ? bars : null,
      lines: asArray(section.lines, SHARE_LINES_MAX).map((lineEntry) => {
        const line = asRecord(lineEntry)
        return {
          text: text(line.text, SHARE_LINE_MAX),
          chords: asArray(line.chords, SHARE_CHORDS_MAX)
            .map((chordEntry): SharedChord | null => {
              const chord = asRecord(chordEntry)
              const name = text(chord.chord, SHARE_CHORD_MAX)
              // A negative or non-numeric offset is corrupt: drop the chord
              // instead of repositioning it — a chord must never jump to the
              // start of the line because its anchor was garbage.
              const raw = chord.position
              const position =
                typeof raw === "number" && Number.isFinite(raw) && raw >= 0
                  ? Math.min(SHARE_CHORD_POSITION_MAX, Math.trunc(raw))
                  : -1
              return name.length > 0 && position >= 0 ? { chord: name, position } : null
            })
            .filter((chordEntry): chordEntry is SharedChord => chordEntry !== null),
        }
      }),
    }
  }),
})

/**
 * Snapshot of a setlist's running order: entries (the document already caches
 * title/artist per entry, so no song reads are needed) plus the dividers from
 * #43, anchored by song id exactly as the real list carries them.
 */
export const sanitizeSharedSetlist = (raw: Record<string, unknown>): SharedSetlistPayload => ({
  date: text(raw.date, 32) || null,
  entries: asArray(raw.songs, SHARE_ENTRIES_MAX).map((entry) => {
    const row = asRecord(entry)
    return {
      songId: text(row.songId, 64),
      title: text(row.title, SHARE_TITLE_MAX),
      artist: text(row.artist, SHARE_ARTIST_MAX),
      key: text(row.key, SHARE_KEY_MAX),
      note: text(row.note, SHARE_NOTE_MAX),
    }
  }),
  dividers: asArray(raw.blocks, SHARE_DIVIDERS_MAX).map((entry) => {
    const block = asRecord(entry)
    const after = text(block.afterSongId, 64)
    return { name: text(block.name, 80), afterSongId: after.length > 0 ? after : null }
  }),
})

/** Absolute expiry in epoch milliseconds, or `null` for a never-expiring link. */
export const shareExpiryAt = (days: number | null, nowMs: number): number | null =>
  days === null ? null : nowMs + days * 86_400_000

/** Shape check for a caller-supplied token before it touches a document path. */
export const isShareToken = (value: unknown): value is string =>
  typeof value === "string" && SHARE_TOKEN_PATTERN.test(value)

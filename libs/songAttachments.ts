import type { SongAttachment } from "@/interfaces/song"
import type { TimestampLike } from "@/interfaces/timestamp"
import { normalizeSongLink } from "@/libs/songLinks"

/**
 * Song attachments (roadmap #40): per-song PDFs and links with their own
 * notes. Everything here is pure — the same rules guard the editor, the write
 * to Firestore (`services/songAttachments.ts`) and every render, exactly like
 * `libs/songLinks.ts`. Stored documents are untrusted input: each entry
 * self-heals field by field and unusable ones (no openable URL) drop out,
 * because rules cannot iterate the list to pin its contents (the `markers` /
 * `showLog` precedent).
 */

/** Hard cap per song — pinned by `firestore.rules` (`attachments.size() <= 20`). */
export const MAX_SONG_ATTACHMENTS = 20

/** Display label clamp (the editor's input cap). */
export const ATTACHMENT_NAME_MAX = 80

/** Per-entry note clamp — the exact number the UI's textarea allows. */
export const ATTACHMENT_NOTE_MAX = 200

/** Storage's own cap: the same 10 MB `storage.rules` enforces. */
export const ATTACHMENT_FILE_MAX_BYTES = 10 * 1024 * 1024

/** Label keys for the size readout, so the formatter never builds strings. */
export const SONG_ATTACHMENT_SIZE_KEYS = {
  kb: "attachments.sizeKb",
  mb: "attachments.sizeMb",
} as const

/** `"charts/My Song.PDF"` → `"My Song"` — the default label of a picked file. */
export const attachmentBaseName = (fileName: string): string => {
  const base = fileName.split(/[\\/]/).pop() ?? ""
  return base.replace(/\.pdf$/i, "").trim()
}

/**
 * The one client gate before an upload: the rules pin `application/pdf`, so a
 * file that would bounce has to be caught before it is read into memory.
 */
export const isPdfFileName = (fileName: string): boolean => /\.pdf$/i.test(fileName.trim())

/** `https://drive.google.com/…` → `drive.google.com` (no URL constructor: RN-safe). */
export const linkHost = (url: string): string =>
  url
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split("?")[0]
    .replace(/^www\./i, "")

/** Bytes → `{ key, value }` for the locale files to spell (`SONG_STATUS_LABEL_KEYS` pattern). */
export const attachmentSize = (
  bytes: number,
): { key: (typeof SONG_ATTACHMENT_SIZE_KEYS)[keyof typeof SONG_ATTACHMENT_SIZE_KEYS]; value: string } => {
  const safe = Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : 0
  if (safe >= 1024 * 1024) {
    return { key: SONG_ATTACHMENT_SIZE_KEYS.mb, value: (safe / (1024 * 1024)).toFixed(1) }
  }
  return { key: SONG_ATTACHMENT_SIZE_KEYS.kb, value: String(Math.max(1, Math.round(safe / 1024))) }
}

const collapse = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""

const clamp = (value: string, max: number): string => (value.length > max ? value.slice(0, max) : value)

const mapAttachment = (raw: unknown, index: number): SongAttachment | null => {
  if (!raw || typeof raw !== "object") return null
  const entry = raw as Partial<SongAttachment>

  const url = normalizeSongLink(entry.url)
  // Nothing to open = nothing the band can use; drop the entry entirely.
  if (url.length === 0) return null

  // A kind the app no longer knows still keeps its nature from the path.
  const kind: SongAttachment["kind"] =
    entry.kind === "file" || entry.kind === "link" ? entry.kind : entry.path ? "file" : "link"

  let name = collapse(entry.name)
  if (name.length === 0) name = kind === "file" ? attachmentBaseName(entry.path || url) : linkHost(url)
  if (name.length === 0) name = "—"

  const rawSize = typeof entry.size === "number" && Number.isFinite(entry.size) ? Math.round(entry.size) : 0
  const note = typeof entry.note === "string" ? clamp(entry.note.trim(), ATTACHMENT_NOTE_MAX) : ""

  return {
    id: typeof entry.id === "string" && entry.id.length > 0 ? entry.id : `att_${index}`,
    kind,
    name: clamp(name, ATTACHMENT_NAME_MAX),
    url,
    // Only a file carries a Storage path; a link never points at an object.
    path: kind === "file" && typeof entry.path === "string" ? entry.path : "",
    size: kind === "link" ? 0 : Math.max(0, rawSize),
    note,
    uploadedBy: typeof entry.uploadedBy === "string" ? clamp(entry.uploadedBy, 128) : "",
    uploadedByName: typeof entry.uploadedByName === "string" ? clamp(collapse(entry.uploadedByName), ATTACHMENT_NAME_MAX) : "",
    uploadedAt: (entry.uploadedAt ?? null) as TimestampLike | null,
  }
}

/**
 * Rebuilds an attachment list from untrusted JSON: invalid entries drop out,
 * fields self-heal, labels collapse, notes clamp and the list is capped at
 * `MAX_SONG_ATTACHMENTS`. Ids missing on a healed entry become `att_<index>` —
 * the app's own ids are always longer, so they cannot collide with one.
 */
export const sanitizeSongAttachments = (raw: unknown): SongAttachment[] => {
  if (!Array.isArray(raw)) return []
  return raw
    .map(mapAttachment)
    .filter((entry): entry is SongAttachment => entry !== null)
    .slice(0, MAX_SONG_ATTACHMENTS)
}

import type {
  OrganizationMember,
  Performance,
  PerformanceInput,
  PerformanceSetlist,
  Setlist,
  SetlistBlock,
  SetlistInput,
  ShowLogEntry,
  Song,
  SongInput,
  Venue,
} from "@/interfaces"
import { parseChordPro, type ChordProDocument } from "@/libs/chordpro"
import { createSection, parseLyricBlock } from "@/libs/songUtils"
import { parseTags, ISO_DATE_PATTERN, TIME_PATTERN } from "@/libs/validation"
import { normalizeSongText, findDuplicateSongs } from "@/libs/songSearch"
import { mapSongInput } from "@/libs/songMapper"
import { normalizeSongLinks } from "@/libs/songLinks"
import { normalizeRole } from "@/libs/membership"
import { sanitizeShowLog } from "@/libs/showLog"
import { cleanBlocks } from "@/libs/setlistBlocks"

/**
 * Band backup and bulk import (roadmap #38).
 *
 * The backup is one self-contained JSON document: every song with its
 * sections, every setlist with its keys/notes/dividers, every event with its
 * show log. Ids are kept so relationships survive a restore, and the import
 * remaps them onto freshly created documents — a song that already exists in
 * the band (same normalised title, #39's rule) is never duplicated: the
 * setlist entry simply points at the song that is already there, which is
 * what makes re-importing the same backup idempotent.
 *
 * Everything here is pure: parsing rebuilds every field from untrusted JSON
 * (the `mapSongInput` mapper precedent — invalid shapes self-heal instead of
 * being trusted wholesale), so this module never imports Firebase.
 */

export const BAND_BACKUP_FORMAT = "setuno.band-backup"
export const BAND_BACKUP_VERSION = 1

/**
 * An import can never push the band past what the app subscribes (the P0.9
 * listener windows): a bigger file is refused whole rather than half-visible.
 */
export const IMPORT_CAPS = { songs: 500, setlists: 200, performances: 300 } as const

/** A song of a backup file: its editable content plus the id the file uses. */
export interface BandBackupSong extends SongInput {
  id: string
}

export interface BandBackupSetlistSong {
  songId: string
  key: string
  note: string
}

export interface BandBackupSetlist {
  id: string
  name: string
  description: string
  date: string | null
  notes: string
  songs: BandBackupSetlistSong[]
  blocks: SetlistBlock[]
  targetMinutes: number
  breakMinutes: number
  template: boolean
}

export interface BandBackupPerformance {
  id: string
  name: string
  date: string
  endDate: string | null
  startTime: string
  endTime: string
  venue: Venue
  notes: string
  setlists: PerformanceSetlist[]
  status: Performance["status"]
  type: Performance["type"]
  showLog: ShowLogEntry[]
}

export interface BandBackupMember {
  displayName: string
  role: string
}

export interface BandBackup {
  format: string
  version: number
  exportedAt: string
  organization: { name: string }
  /** Record only — membership is invitation-based and never restored. */
  members: BandBackupMember[]
  songs: BandBackupSong[]
  setlists: BandBackupSetlist[]
  performances: BandBackupPerformance[]
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export interface BuildBandBackupInput {
  organizationName: string
  members: readonly OrganizationMember[]
  songs: readonly Song[]
  setlists: readonly Setlist[]
  performances: readonly Performance[]
  exportedAt: string
}

/**
 * Snapshots the band as it is on screen. Attendance and the live-share link
 * are deliberately left out: their uids/tokens belong to this project and
 * would mean nothing after a restore into a fresh band.
 */
export const buildBandBackup = (input: BuildBandBackupInput): BandBackup => ({
  format: BAND_BACKUP_FORMAT,
  version: BAND_BACKUP_VERSION,
  exportedAt: input.exportedAt,
  organization: { name: input.organizationName },
  members: input.members.map((member) => ({ displayName: member.displayName, role: member.role })),
  songs: input.songs.map((song) => ({
    id: song.id,
    title: song.title,
    artist: song.artist,
    key: song.key,
    originalKey: song.originalKey,
    capo: song.capo,
    bpm: song.bpm,
    durationSec: song.durationSec,
    genre: song.genre,
    notes: song.notes,
    tags: song.tags,
    sections: song.sections,
    links: song.links,
    status: song.status,
  })),
  setlists: input.setlists.map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    date: list.date,
    notes: list.notes,
    songs: [...list.songs]
      .sort((a, b) => a.order - b.order)
      .map((entry) => ({ songId: entry.songId, key: entry.key, note: entry.note })),
    blocks: list.blocks,
    targetMinutes: list.targetMinutes,
    breakMinutes: list.breakMinutes,
    template: list.template,
  })),
  performances: input.performances.map((show) => ({
    id: show.id,
    name: show.name,
    date: show.date,
    endDate: show.endDate,
    startTime: show.startTime,
    endTime: show.endTime,
    venue: show.venue,
    notes: show.notes,
    setlists: show.setlists,
    status: show.status,
    type: show.type,
    showLog: show.showLog,
  })),
})

export const serializeBandBackup = (backup: BandBackup): string => JSON.stringify(backup, null, 2)

/* ------------------------------------------------------------------ */
/* Parse (untrusted input)                                             */
/* ------------------------------------------------------------------ */

const clampInt = (
  value: string | undefined,
  min: number,
  max: number,
  fallback: number | null,
): number | null => {
  const parsed = Number.parseInt((value ?? "").trim(), 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

/** `mm:ss` (or a plain second count) into seconds; empty/garbage is null. */
const parseDuration = (value: string | undefined): number | null => {
  const trimmed = (value ?? "").trim()
  if (trimmed.length === 0) return null
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(trimmed)
  if (match) return Number(match[1]) * 60 + Number(match[2])
  const seconds = Number.parseInt(trimmed, 10)
  return Number.isNaN(seconds) || seconds <= 0 ? null : seconds
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const stringAt = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : ""

const idAt = (value: unknown, prefix: string, index: number): string =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : `${prefix}_${index}`

/** A song entry of an untrusted backup: one mapper, self-healing fields. */
const sanitizeBackupSong = (raw: unknown, index: number): BandBackupSong | null => {
  if (!isRecord(raw)) return null
  const song = mapSongInput(raw)
  const title = song.title.trim()
  if (title.length === 0) return null
  return { ...song, id: idAt(raw.id, "song", index), title }
}

const sanitizeBackupSetlist = (raw: unknown, index: number): BandBackupSetlist | null => {
  if (!isRecord(raw)) return null
  const name = stringAt(raw.name, 100).trim()
  if (name.length === 0) return null

  const songs = Array.isArray(raw.songs) ? raw.songs : []
  const entries: BandBackupSetlistSong[] = []
  for (const entry of songs) {
    if (!isRecord(entry) || typeof entry.songId !== "string" || entry.songId.length === 0) continue
    entries.push({
      songId: entry.songId,
      key: stringAt(entry.key, 20).trim(),
      note: stringAt(entry.note, 300).trim(),
    })
  }

  const blocks = Array.isArray(raw.blocks) ? raw.blocks : []
  return {
    id: idAt(raw.id, "setlist", index),
    name,
    description: stringAt(raw.description, 500),
    date: typeof raw.date === "string" && ISO_DATE_PATTERN.test(raw.date) ? raw.date : null,
    notes: stringAt(raw.notes, 2000),
    songs: entries,
    blocks: cleanBlocks(blocks as SetlistBlock[]),
    targetMinutes: clampInt(String(raw.targetMinutes), 0, 600, 0) ?? 0,
    breakMinutes: clampInt(String(raw.breakMinutes), 0, 600, 0) ?? 0,
    template: raw.template === true,
  }
}

const sanitizeBackupPerformance = (raw: unknown, index: number): BandBackupPerformance | null => {
  if (!isRecord(raw)) return null
  const name = stringAt(raw.name, 120).trim()
  const date = typeof raw.date === "string" ? raw.date : ""
  if (name.length === 0 || !ISO_DATE_PATTERN.test(date)) return null

  const venue = isRecord(raw.venue) ? raw.venue : {}
  const attached = Array.isArray(raw.setlists) ? raw.setlists : []
  const setlists: PerformanceSetlist[] = []
  for (const entry of attached) {
    if (!isRecord(entry) || typeof entry.id !== "string" || entry.id.length === 0) continue
    setlists.push({ id: entry.id, name: stringAt(entry.name, 100) })
  }

  return {
    id: idAt(raw.id, "show", index),
    name,
    date,
    endDate: typeof raw.endDate === "string" && ISO_DATE_PATTERN.test(raw.endDate) ? raw.endDate : null,
    startTime: typeof raw.startTime === "string" && TIME_PATTERN.test(raw.startTime) ? raw.startTime : "",
    endTime: typeof raw.endTime === "string" && TIME_PATTERN.test(raw.endTime) ? raw.endTime : "",
    venue: {
      name: stringAt(venue.name, 120),
      address: stringAt(venue.address, 200),
      notes: stringAt(venue.notes, 500),
    },
    notes: stringAt(raw.notes, 2000),
    setlists,
    status: raw.status === "completed" || raw.status === "cancelled" ? raw.status : "scheduled",
    type: raw.type === "rehearsal" ? "rehearsal" : "gig",
    showLog: sanitizeShowLog(Array.isArray(raw.showLog) ? raw.showLog : []),
  }
}

/**
 * Parses a backup document, rebuilding every field defensively. Returns null
 * only when the file is not a Setuno backup at all (not JSON, wrong format
 * marker, or a version from a future app that we would misunderstand).
 */
export const parseBandBackup = (text: string): BandBackup | null => {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(data)) return null
  if (data.format !== BAND_BACKUP_FORMAT) return null
  if (
    typeof data.version !== "number" ||
    data.version < 1 ||
    data.version > BAND_BACKUP_VERSION
  ) {
    return null
  }

  const organization = isRecord(data.organization) ? data.organization : {}
  const members = Array.isArray(data.members) ? data.members : []
  const songs = Array.isArray(data.songs) ? data.songs : []
  const setlists = Array.isArray(data.setlists) ? data.setlists : []
  const performances = Array.isArray(data.performances) ? data.performances : []

  return {
    format: BAND_BACKUP_FORMAT,
    version: BAND_BACKUP_VERSION,
    exportedAt: stringAt(data.exportedAt, 40),
    organization: { name: stringAt(organization.name, 100) },
    members: members
      .filter(isRecord)
      .map((member) => ({
        displayName: stringAt(member.displayName, 80).trim(),
        role: normalizeRole(member.role),
      }))
      .filter((member) => member.displayName.length > 0),
    songs: songs
      .map((entry, index) => sanitizeBackupSong(entry, index))
      .filter((song): song is BandBackupSong => song !== null),
    setlists: setlists
      .map((entry, index) => sanitizeBackupSetlist(entry, index))
      .filter((list): list is BandBackupSetlist => list !== null),
    performances: performances
      .map((entry, index) => sanitizeBackupPerformance(entry, index))
      .filter((show): show is BandBackupPerformance => show !== null),
  }
}

/** The empty document every picked file merges into before planning. */
export const emptyBandBackup = (): BandBackup => ({
  format: BAND_BACKUP_FORMAT,
  version: BAND_BACKUP_VERSION,
  exportedAt: "",
  organization: { name: "" },
  members: [],
  songs: [],
  setlists: [],
  performances: [],
})

/** Concatenates parsed files into one document (never mutates its inputs). */
export const mergeBackups = (left: BandBackup, right: BandBackup): BandBackup => ({
  ...left,
  members: [...left.members, ...right.members],
  songs: [...left.songs, ...right.songs],
  setlists: [...left.setlists, ...right.setlists],
  performances: [...left.performances, ...right.performances],
})

/* ------------------------------------------------------------------ */
/* CSV / ChordPro bulk songs                                           */
/* ------------------------------------------------------------------ */

/**
 * RFC 4180-ish rows: quoted cells ("" escapes a quote), commas and newlines
 * inside quotes, CRLF tolerated, a BOM stripped. Blank rows are dropped.
 */
export const parseCsvRows = (text: string): string[][] => {
  const source = text.replace(/^\uFEFF/, "")
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let index = 0; index < source.length; index++) {
    const char = source[index]!
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"'
          index++
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"' && cell.length === 0) {
      quoted = true
    } else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else if (char !== "\r") {
      cell += char
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((entry) => entry.some((value) => value.trim().length > 0))
}

export interface CsvSongsResult {
  songs: BandBackupSong[]
  /** Spreadsheet row numbers (header is row 1) of rows skipped for no title. */
  skippedRows: number[]
  /** True when the file has no recognisable header — not a song CSV at all. */
  invalid: boolean
}

/**
 * One song per row. `title` is required; `artist`, `key`, `capo`, `bpm`,
 * `genre`, `tags`, `duration` (mm:ss), `notes` and `lyrics` (inline `[C]`
 * chords, through the same paste parser #19 shipped) are optional, unknown
 * columns are ignored, and imported songs land as **active** (#30's rule for
 * bulk writes).
 */
export const parseSongsCsv = (text: string): CsvSongsResult => {
  const rows = parseCsvRows(text)
  if (rows.length === 0) return { songs: [], skippedRows: [], invalid: true }

  const header = rows[0]!.map((cell) => cell.trim().toLowerCase())
  const column = (...names: string[]): number =>
    names.reduce((found, name) => (found >= 0 ? found : header.indexOf(name)), -1)

  const titleCol = column("title")
  if (titleCol === -1) return { songs: [], skippedRows: [], invalid: true }

  const artistCol = column("artist")
  const keyCol = column("key")
  const capoCol = column("capo")
  const bpmCol = column("bpm", "tempo")
  const genreCol = column("genre")
  const tagsCol = column("tags")
  const durationCol = column("duration", "length")
  const notesCol = column("notes")
  const lyricsCol = column("lyrics", "lyric", "words")

  const songs: BandBackupSong[] = []
  const skippedRows: number[] = []

  rows.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2
    const title = (cells[titleCol] ?? "").trim()
    if (title.length === 0) {
      skippedRows.push(rowNumber)
      return
    }
    const key = (cells[keyCol] ?? "").trim()
    const lyrics = (cells[lyricsCol] ?? "").trim()
    const sections = lyrics.length > 0 ? parseLyricBlock(lyrics) : []
    songs.push({
      id: `csv_${rowNumber}`,
      title,
      artist: (cells[artistCol] ?? "").trim(),
      key,
      originalKey: key,
      capo: clampInt(cells[capoCol], 0, 12, 0) ?? 0,
      bpm: clampInt(cells[bpmCol], 20, 400, null),
      durationSec: parseDuration(cells[durationCol]),
      genre: (cells[genreCol] ?? "").trim(),
      notes: (cells[notesCol] ?? "").trim(),
      tags: parseTags(cells[tagsCol] ?? ""),
      sections: sections.length > 0 ? sections : [createSection("verse", "Verse")],
      links: normalizeSongLinks({}),
      status: "active",
    })
  })

  return { songs, skippedRows, invalid: false }
}

/**
 * One `.cho` document becomes one active song; the file name is the title
 * fallback for the many exports that carry no `{title}`. Returns null when
 * there is no title at all — a songless song is not worth a dialog row.
 */
export const chordProToBackupSong = (
  document: ChordProDocument,
  id: string,
  fallbackTitle: string,
): BandBackupSong | null => {
  const title = document.title.trim().length > 0 ? document.title.trim() : fallbackTitle.trim()
  if (title.length === 0) return null
  return {
    id,
    title,
    artist: document.artist.trim(),
    key: document.key.trim(),
    originalKey: document.key.trim(),
    capo: clampInt(String(document.capo), 0, 12, 0) ?? 0,
    bpm: null,
    durationSec: null,
    genre: "",
    notes: "",
    tags: [],
    sections: document.sections.length > 0 ? document.sections : [createSection("verse", "Verse")],
    links: normalizeSongLinks({}),
    status: "active",
  }
}

/** Parses a `.cho` source (file or zip entry) into a song draft. */
export const parseChoSource = (
  source: string,
  id: string,
  fallbackTitle: string,
): BandBackupSong | null => chordProToBackupSong(parseChordPro(source), id, fallbackTitle)

/** `songs/Melody_Choir.cho` → `Melody Choir` (the `.cho` title fallback). */
export const fileNameTitle = (fileName: string): string =>
  (fileName.split(/[\\/]/).pop() ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim()

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

export interface ImportPlan {
  /** Songs to create, in file order. */
  songs: BandBackupSong[]
  /** Setlists to create; their song ids remap through `songIdMap`. */
  setlists: BandBackupSetlist[]
  /** Events to create; their setlist refs remap through `setlistIdMap`. */
  performances: BandBackupPerformance[]
  /** Old song id → the id it will use (matched existing song or created one). */
  songIdMap: Record<string, string>
  /** Old setlist id → existing matched setlist (created ones fill in later). */
  setlistIdMap: Record<string, string>
  skipped: { songs: number; setlists: number; performances: number }
  /** True when the file would exceed what the app can subscribe. */
  tooLarge: boolean
}

/**
 * Decides what an import would do before it writes anything. A song that
 * already exists (#39's normalised-title rule, artist-narrowed) is skipped
 * and **mapped** to the live document — the backup's setlists and events then
 * point at it, which is what makes restoring the same file twice a no-op
 * instead of a pile of twins.
 */
export const planBackupImport = (
  backup: BandBackup,
  existing: { songs: Song[]; setlists: Setlist[]; performances: Performance[] },
): ImportPlan => {
  const songIdMap: Record<string, string> = {}
  const songs: BandBackupSong[] = []
  let skippedSongs = 0
  for (const draft of backup.songs) {
    const match = findDuplicateSongs(existing.songs, { title: draft.title, artist: draft.artist })[0]
    if (match) {
      songIdMap[draft.id] = match.song.id
      skippedSongs++
      continue
    }
    songs.push(draft)
  }

  const setlistIdMap: Record<string, string> = {}
  const existingByName = new Map(existing.setlists.map((list) => [normalizeSongText(list.name), list.id]))
  const setlists: BandBackupSetlist[] = []
  let skippedSetlists = 0
  for (const list of backup.setlists) {
    const matched = existingByName.get(normalizeSongText(list.name))
    if (matched) {
      setlistIdMap[list.id] = matched
      skippedSetlists++
      continue
    }
    setlists.push(list)
  }

  const showKey = (show: { name: string; date: string }): string =>
    `${normalizeSongText(show.name)}|${show.date}`
  const existingShows = new Set(existing.performances.map(showKey))
  const performances: BandBackupPerformance[] = []
  let skippedPerformances = 0
  for (const show of backup.performances) {
    if (existingShows.has(showKey(show))) {
      skippedPerformances++
      continue
    }
    performances.push(show)
  }

  return {
    songs,
    setlists,
    performances,
    songIdMap,
    setlistIdMap,
    skipped: { songs: skippedSongs, setlists: skippedSetlists, performances: skippedPerformances },
    tooLarge:
      songs.length > IMPORT_CAPS.songs ||
      setlists.length > IMPORT_CAPS.setlists ||
      performances.length > IMPORT_CAPS.performances,
  }
}

/**
 * A setlist ready for `createSetlist`: ids remapped through the plan, play
 * keys and notes carried per entry, and dividers re-anchored — a divider
 * whose song did not make it into the import falls back to the nearest
 * earlier imported song (or the top), never vanishes (#43's contract).
 */
export const remapSetlistForImport = (
  list: BandBackupSetlist,
  songIdMap: Record<string, string>,
): SetlistInput => {
  const entries = list.songs.filter((entry) => Boolean(songIdMap[entry.songId]))
  const songIds = entries.map((entry) => songIdMap[entry.songId]!)

  const songKeys: Record<string, string> = {}
  const songNotes: Record<string, string> = {}
  for (const entry of entries) {
    const id = songIdMap[entry.songId]!
    if (entry.key.length > 0) songKeys[id] = entry.key
    if (entry.note.length > 0) songNotes[id] = entry.note
  }

  const fallbackAnchor = (songId: string): string | null => {
    const at = list.songs.findIndex((entry) => entry.songId === songId)
    for (let index = at - 1; index >= 0; index--) {
      const mapped = songIdMap[list.songs[index]!.songId]
      if (mapped) return mapped
    }
    return null
  }

  return {
    name: list.name,
    description: list.description,
    date: list.date,
    notes: list.notes,
    songIds,
    songKeys,
    songNotes,
    // Line-ups are **not** carried by a backup (roadmap #88): a line-up names
    // member uids, and those mean nothing after a restore into another band —
    // the same reason `attendance` and `liveShare` are left out (#38).
    songLineups: {},
    targetMinutes: list.targetMinutes,
    breakMinutes: list.breakMinutes,
    blocks: cleanBlocks(
      list.blocks.map((block) => ({
        id: block.id,
        name: block.name,
        afterSongId: block.afterSongId
          ? (songIdMap[block.afterSongId] ?? fallbackAnchor(block.afterSongId))
          : null,
      })),
    ),
  }
}

/** An event ready for `createPerformance`: attached lists remapped by id. */
export const remapPerformanceForImport = (
  show: BandBackupPerformance,
  setlistIdMap: Record<string, string>,
): PerformanceInput => ({
  name: show.name,
  date: show.date,
  endDate: show.endDate,
  startTime: show.startTime,
  endTime: show.endTime,
  venue: show.venue,
  notes: show.notes,
  setlists: show.setlists
    .filter((entry) => Boolean(setlistIdMap[entry.id]))
    .map((entry) => ({ id: setlistIdMap[entry.id]!, name: entry.name })),
  status: show.status,
  type: show.type,
})

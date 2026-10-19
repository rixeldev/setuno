import { describe, expect, it } from "vitest"

import type { OrganizationMember } from "@/interfaces/organization"
import type { Performance } from "@/interfaces/performance"
import type { Setlist } from "@/interfaces/setlist"
import { EMPTY_SONG_LINKS } from "@/interfaces/song"
import type { Song } from "@/interfaces/song"
import type { TimestampLike } from "@/interfaces/timestamp"
import {
  BAND_BACKUP_FORMAT,
  BAND_BACKUP_VERSION,
  IMPORT_CAPS,
  buildBandBackup,
  chordProToBackupSong,
  emptyBandBackup,
  fileNameTitle,
  mergeBackups,
  parseBandBackup,
  parseChoSource,
  parseCsvRows,
  parseSongsCsv,
  planBackupImport,
  remapPerformanceForImport,
  remapSetlistForImport,
  serializeBandBackup,
  type BandBackupPerformance,
  type BandBackupSetlist,
  type BandBackupSong,
} from "@/libs/bandBackup"

const TIMESTAMP: TimestampLike = { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) }

const song = (id: string, title: string, artist = ""): Song => ({
  id,
  organizationId: "org-1",
  title,
  artist,
  key: "G",
  originalKey: "G",
  capo: 0,
  bpm: null,
  durationSec: null,
  genre: "",
  notes: "",
  tags: [],
  sections: [],
  links: EMPTY_SONG_LINKS,
  status: "active",
  deletedAt: null,
  deletedBy: null,
  createdBy: "uid-1",
  createdByName: "Admin",
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
})

const setlist = (id: string, name: string, overrides: Partial<Setlist> = {}): Setlist => ({
  id,
  organizationId: "org-1",
  name,
  description: "",
  date: null,
  notes: "",
  songs: [],
  blocks: [],
  estimatedDurationSec: 0,
  targetMinutes: 0,
  breakMinutes: 0,
  template: false,
  createdBy: "uid-1",
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  ...overrides,
})

const performance = (id: string, overrides: Partial<Performance> = {}): Performance => ({
  id,
  organizationId: "org-1",
  name: id,
  date: "2026-10-13",
  endDate: null,
  startTime: "20:00",
  endTime: "22:00",
  venue: { name: "Sala Sur", address: "", notes: "" },
  notes: "",
  setlists: [],
  status: "scheduled",
  type: "gig",
  showLog: [],
  attendance: {},
  liveShare: null,
  createdBy: "uid-1",
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  ...overrides,
})

const member = (displayName: string, role: string = "member"): OrganizationMember => ({
  uid: `uid-${displayName}`,
  displayName,
  email: `${displayName}@example.com`,
  photoURL: null,
  role: role as OrganizationMember["role"],
  joinedAt: TIMESTAMP,
  invitedBy: null,
})

const draft = (id: string, title: string, artist = ""): BandBackupSong => ({
  id,
  title,
  artist,
  key: "",
  originalKey: "",
  capo: 0,
  bpm: null,
  durationSec: null,
  genre: "",
  notes: "",
  tags: [],
  sections: [],
  links: EMPTY_SONG_LINKS,
  status: "active",
})

const backupSetlist = (id: string, name: string): BandBackupSetlist => ({
  id,
  name,
  description: "",
  date: null,
  notes: "",
  songs: [],
  blocks: [],
  targetMinutes: 0,
  breakMinutes: 0,
  template: false,
})

const backupPerformance = (id: string, name: string, date: string): BandBackupPerformance => ({
  id,
  name,
  date,
  endDate: null,
  startTime: "",
  endTime: "",
  venue: { name: "", address: "", notes: "" },
  notes: "",
  setlists: [],
  status: "scheduled",
  type: "gig",
  showLog: [],
})

describe("buildBandBackup / parseBandBackup", () => {
  it("round-trips a whole band through the serialized document", () => {
    const backup = buildBandBackup({
      organizationName: "Los Truenos",
      members: [member("Ann", "admin")],
      songs: [song("s1", "Wonderwall", "Oasis")],
      setlists: [
        setlist("l1", "Friday", {
          songs: [
            { songId: "s1", title: "Wonderwall", artist: "Oasis", key: "G", order: 0, note: "tune Eb" },
          ],
          targetMinutes: 90,
          template: true,
        }),
      ],
      performances: [performance("p1", { setlists: [{ id: "l1", name: "Friday" }] })],
      exportedAt: "2026-10-19T10:00:00.000Z",
    })

    const parsed = parseBandBackup(serializeBandBackup(backup))
    expect(parsed).not.toBeNull()
    expect(parsed!.format).toBe(BAND_BACKUP_FORMAT)
    expect(parsed!.version).toBe(BAND_BACKUP_VERSION)
    expect(parsed!.exportedAt).toBe("2026-10-19T10:00:00.000Z")
    expect(parsed!.organization).toEqual({ name: "Los Truenos" })
    expect(parsed!.members).toEqual([{ displayName: "Ann", role: "admin" }])
    expect(parsed!.songs[0]).toMatchObject({ id: "s1", title: "Wonderwall", artist: "Oasis", key: "G" })
    expect(parsed!.setlists[0]).toMatchObject({ id: "l1", name: "Friday", targetMinutes: 90, template: true })
    expect(parsed!.setlists[0]!.songs).toEqual([{ songId: "s1", key: "G", note: "tune Eb" }])
    expect(parsed!.performances[0]).toMatchObject({
      id: "p1",
      date: "2026-10-13",
      setlists: [{ id: "l1", name: "Friday" }],
    })
  })

  it("exports setlist entries in running-order, not array, order", () => {
    const backup = buildBandBackup({
      organizationName: "Band",
      members: [],
      songs: [],
      setlists: [
        setlist("l1", "Set", {
          songs: [
            { songId: "b", title: "B", artist: "", key: "", order: 1, note: "" },
            { songId: "a", title: "A", artist: "", key: "", order: 0, note: "" },
          ],
        }),
      ],
      performances: [],
      exportedAt: "",
    })
    expect(backup.setlists[0]!.songs.map((entry) => entry.songId)).toEqual(["a", "b"])
  })

  it("refuses anything that is not a Setuno backup", () => {
    expect(parseBandBackup("not json at all")).toBeNull()
    expect(parseBandBackup("[1,2,3]")).toBeNull()
    expect(parseBandBackup(JSON.stringify({ format: "other.app", version: 1 }))).toBeNull()
    // A future format is refused whole: reading it with today's rules could
    // silently drop what the newer app stored.
    expect(parseBandBackup(JSON.stringify({ format: BAND_BACKUP_FORMAT, version: 2 }))).toBeNull()
    expect(parseBandBackup(JSON.stringify({ format: BAND_BACKUP_FORMAT, version: "x" }))).toBeNull()
  })

  it("self-heals untrusted fields and drops unusable entries", () => {
    const parsed = parseBandBackup(
      JSON.stringify({
        format: BAND_BACKUP_FORMAT,
        version: 1,
        members: [
          { displayName: "  Ann  ", role: "boss" },
          { displayName: "", role: "admin" },
        ],
        songs: [
          {
            id: "s1",
            title: "  Wonderwall ",
            sections: [
              {
                id: "sec",
                type: "verse",
                lines: [{ text: "hi", chords: [{ chord: "G", position: "not-a-number" }] }],
              },
            ],
          },
          { title: "   " },
          { id: "s2", title: "No Sections", sections: "nope" },
        ],
        setlists: [
          {
            id: "l1",
            name: "  Friday  ",
            date: "not-a-date",
            targetMinutes: "9999",
            songs: [
              { songId: "s1", key: "G".repeat(50), note: "n" },
              { key: "G" },
            ],
          },
          { name: "   " },
        ],
        performances: [
          { id: "p1", name: "Bad date", date: "nope" },
          {
            id: "p2",
            name: "Gig",
            date: "2026-01-05",
            status: "weird",
            type: "festival",
            startTime: "8pm",
            showLog: [{ songId: "s1", outcome: "huh", actualSec: -5, note: "", updatedAt: 1 }],
          },
        ],
      }),
    )

    expect(parsed).not.toBeNull()
    expect(parsed!.members).toEqual([{ displayName: "Ann", role: "member" }])

    expect(parsed!.songs.map((entry) => entry.id)).toEqual(["s1", "s2"])
    expect(parsed!.songs[0]!.title).toBe("Wonderwall")
    // A chord whose position is not a number self-heals away (#26's mapper).
    expect(parsed!.songs[0]!.sections[0]!.lines[0]!.chords).toEqual([])
    expect(parsed!.songs[1]!.sections).toEqual([])

    expect(parsed!.setlists).toHaveLength(1)
    expect(parsed!.setlists[0]).toMatchObject({ id: "l1", name: "Friday", date: null, targetMinutes: 600 })
    expect(parsed!.setlists[0]!.songs).toEqual([{ songId: "s1", key: "G".repeat(20), note: "n" }])

    expect(parsed!.performances.map((show) => show.id)).toEqual(["p2"])
    expect(parsed!.performances[0]).toMatchObject({ status: "scheduled", type: "gig", startTime: "" })
    // An outcome nobody understands must never become "skipped" (#30's rule).
    expect(parsed!.performances[0]!.showLog[0]).toMatchObject({ songId: "s1", outcome: "played" })
  })

  it("merges parsed files without mutating the inputs", () => {
    const left = parseBandBackup(
      JSON.stringify({ format: BAND_BACKUP_FORMAT, version: 1, songs: [draft("a", "A")] }),
    )!
    const right = parseBandBackup(
      JSON.stringify({ format: BAND_BACKUP_FORMAT, version: 1, songs: [draft("b", "B")] }),
    )!
    const merged = mergeBackups(left, right)
    expect(merged.songs.map((entry) => entry.id)).toEqual(["a", "b"])
    expect(left.songs.map((entry) => entry.id)).toEqual(["a"])
    expect(right.songs.map((entry) => entry.id)).toEqual(["b"])
    expect(emptyBandBackup().songs).toEqual([])
  })
})

describe("parseCsvRows", () => {
  it("keeps quoted commas, escaped quotes and embedded newlines", () => {
    const rows = parseCsvRows('title,lyrics\r\n"Hello, ""you""","[C] Hi\n\nChorus: la"')
    expect(rows).toEqual([
      ["title", "lyrics"],
      ['Hello, "you"', "[C] Hi\n\nChorus: la"],
    ])
  })

  it("strips a BOM and drops blank rows", () => {
    expect(parseCsvRows("\uFEFFtitle\r\n\r\nA\r\n")).toEqual([["title"], ["A"]])
  })
})

describe("parseSongsCsv", () => {
  const csv = [
    "Title,Artist,Key,Capo,Tempo,Genre,Tags,Length,Notes,Lyrics,Extra",
    'Wonderwall,Oasis,G,99,10,rock,"rock, anthem",3:30,some notes,"[C] Hi there\nChorus:\nyeah yeah",ignored',
    ",No Title Row,,,,,,,,,,",
    'Creep,Radiohead,,abc,,,"",250,,,',
  ].join("\r\n")

  it("reads one song per row with header aliases and clamped numbers", () => {
    const result = parseSongsCsv(csv)
    expect(result.invalid).toBe(false)
    expect(result.skippedRows).toEqual([3])
    expect(result.songs.map((entry) => entry.id)).toEqual(["csv_2", "csv_4"])

    const wonderwall = result.songs[0]!
    expect(wonderwall).toMatchObject({
      title: "Wonderwall",
      artist: "Oasis",
      key: "G",
      originalKey: "G",
      genre: "rock",
      notes: "some notes",
      status: "active",
    })
    expect(wonderwall.capo).toBe(12)
    expect(wonderwall.bpm).toBe(20)
    expect(wonderwall.durationSec).toBe(210)
    expect(wonderwall.tags).toEqual(["rock", "anthem"])
    // Inline chords become the grid through the same paste parser #19 shipped,
    // and the header starts a section as soon as a lyric line follows it.
    expect(wonderwall.sections).toHaveLength(2)
    expect(wonderwall.sections[1]!.type).toBe("chorus")
    expect(wonderwall.sections[0]!.lines[0]!.chords).toEqual([{ chord: "C", position: 0 }])

    const creep = result.songs[1]!
    expect(creep.capo).toBe(0)
    expect(creep.bpm).toBeNull()
    expect(creep.durationSec).toBe(250)
    expect(creep.tags).toEqual([])
    // A song with no lyrics still gets one section, so it opens like any other.
    expect(creep.sections).toHaveLength(1)
  })

  it("reports a file without a title column as unusable", () => {
    expect(parseSongsCsv("a,b\n1,2").invalid).toBe(true)
    expect(parseSongsCsv("").invalid).toBe(true)
  })
})

describe("chordProToBackupSong / parseChoSource", () => {
  it("imports a ChordPro document as an active song", () => {
    const parsed = parseChoSource(
      "{title: Creep}\n{artist: Radiohead}\n{key: G}\n{capo: 99}\n{start_of_chorus}\n[C] hello\n{end_of_chorus}",
      "f1",
      "fallback",
    )
    expect(parsed).toMatchObject({ id: "f1", title: "Creep", artist: "Radiohead", key: "G", capo: 12, status: "active" })
    expect(parsed!.sections.some((section) => section.type === "chorus")).toBe(true)
  })

  it("falls back to the file name and refuses a titleless song", () => {
    const fallback = chordProToBackupSong(
      { title: "", artist: "", key: "", capo: 0, sections: [] },
      "f2",
      "Hotel California",
    )
    expect(fallback!.title).toBe("Hotel California")
    expect(chordProToBackupSong({ title: "", artist: "", key: "", capo: 0, sections: [] }, "f3", "  ")).toBeNull()
    expect(fileNameTitle("songs/Melody_Choir.cho")).toBe("Melody Choir")
  })
})

describe("planBackupImport", () => {
  const existing = {
    songs: [song("e1", "Wonderwall", "Oasis"), song("e2", "Creep", "Radiohead")],
    setlists: [setlist("el1", "Friday Setlist")],
    performances: [performance("ep1", { name: "Sala Sur Gig", date: "2026-10-13" })],
  }

  const backup = buildBandBackup({
    organizationName: "Band",
    members: [],
    songs: [],
    setlists: [],
    performances: [],
    exportedAt: "",
  })

  it("skips and maps songs the band already has (#39's rule)", () => {
    const plan = planBackupImport(
      {
        ...backup,
        songs: [
          draft("b1", "Wonderwall", "Oasis"),
          draft("b2", " creep "),
          draft("b3", "Wonderwall", "Someone Else"),
          draft("b4", "Mad World", "Gary Jules"),
        ],
      },
      existing,
    )
    expect(plan.songs.map((entry) => entry.id)).toEqual(["b3", "b4"])
    expect(plan.songIdMap).toEqual({ b1: "e1", b2: "e2" })
    expect(plan.skipped.songs).toBe(2)
    expect(plan.tooLarge).toBe(false)
  })

  it("deduplicates setlists by name and events by name plus date", () => {
    const plan = planBackupImport(
      {
        ...backup,
        setlists: [backupSetlist("b-l1", "  friday setlist "), backupSetlist("b-l2", "Saturday")],
        performances: [
          backupPerformance("b-p1", "Sala Sur Gig", "2026-10-13"),
          backupPerformance("b-p2", "Sala Sur Gig", "2026-11-01"),
        ],
      },
      existing,
    )
    expect(plan.setlists.map((entry) => entry.id)).toEqual(["b-l2"])
    expect(plan.setlistIdMap).toEqual({ "b-l1": "el1" })
    expect(plan.skipped.setlists).toBe(1)
    expect(plan.performances.map((show) => show.date)).toEqual(["2026-11-01"])
    expect(plan.skipped.performances).toBe(1)
  })

  it("flags a file larger than the app can subscribe", () => {
    const many = Array.from({ length: IMPORT_CAPS.songs + 1 }, (_, index) =>
      draft(`s${index}`, `Song ${index}`),
    )
    const plan = planBackupImport({ ...backup, songs: many }, { songs: [], setlists: [], performances: [] })
    expect(plan.tooLarge).toBe(true)
    expect(plan.songs).toHaveLength(IMPORT_CAPS.songs + 1)
  })
})

describe("remapSetlistForImport / remapPerformanceForImport", () => {
  it("remaps ids, carries keys and notes, and re-anchors dividers", () => {
    const input = remapSetlistForImport(
      {
        id: "l1",
        name: "Friday",
        description: "",
        date: null,
        notes: "",
        songs: [
          { songId: "s1", key: "G", note: "" },
          { songId: "s2", key: "", note: "tune Eb" },
          { songId: "ghost", key: "D", note: "" },
        ],
        blocks: [
          { id: "b1", name: "Set 1", afterSongId: "s2" },
          { id: "b2", name: "Break", afterSongId: "ghost" },
          { id: "b3", name: "Encore", afterSongId: null },
          { id: "b4", name: "   ", afterSongId: null },
        ],
        targetMinutes: 90,
        breakMinutes: 10,
        template: true,
      },
      { s1: "n1", s2: "n2" },
    )

    expect(input.songIds).toEqual(["n1", "n2"])
    expect(input.songKeys).toEqual({ n1: "G" })
    expect(input.songNotes).toEqual({ n2: "tune Eb" })
    expect(input.targetMinutes).toBe(90)
    expect(input.breakMinutes).toBe(10)
    // A divider whose song did not make it falls back to the nearest earlier
    // imported song — it moves, never vanishes (#43's contract). The unnamed
    // one is dropped by the same hygiene the editor uses.
    expect(input.blocks).toEqual([
      { id: "b1", name: "Set 1", afterSongId: "n2" },
      { id: "b2", name: "Break", afterSongId: "n2" },
      { id: "b3", name: "Encore", afterSongId: null },
    ])
  })

  it("drops event attachments whose setlist is gone and keeps the rest", () => {
    const input = remapPerformanceForImport(
      {
        id: "p1",
        name: "Gig",
        date: "2026-10-13",
        endDate: null,
        startTime: "20:00",
        endTime: "22:00",
        venue: { name: "Sala Sur", address: "", notes: "" },
        notes: "",
        setlists: [
          { id: "l1", name: "Main" },
          { id: "gone", name: "Old" },
        ],
        status: "completed",
        type: "rehearsal",
        showLog: [],
      },
      { l1: "n9" },
    )
    expect(input.setlists).toEqual([{ id: "n9", name: "Main" }])
    expect(input).toMatchObject({ name: "Gig", date: "2026-10-13", status: "completed", type: "rehearsal" })
  })
})

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  ATTACHMENT_NAME_MAX,
  ATTACHMENT_NOTE_MAX,
  MAX_SONG_ATTACHMENTS,
  SONG_ATTACHMENT_SIZE_KEYS,
  attachmentBaseName,
  attachmentSize,
  isPdfFileName,
  linkHost,
  sanitizeSongAttachments,
} from "@/libs/songAttachments"
import type { SongAttachment } from "@/interfaces/song"

const fileEntry = (overrides: Partial<SongAttachment> = {}): Record<string, unknown> => ({
  id: "att_1",
  kind: "file",
  name: "Chart",
  url: "https://firebasestorage.googleapis.com/o/chart.pdf?token=x",
  path: "organizations/o1/songs/s1/attachments/alice/att_1.pdf",
  size: 2048,
  note: "Bb",
  uploadedBy: "alice",
  uploadedByName: "Alice",
  uploadedAt: new Date("2026-10-01T10:00:00Z"),
  ...overrides,
})

describe("sanitizeSongAttachments", () => {
  it("reads junk and absence as an empty list", () => {
    expect(sanitizeSongAttachments(undefined)).toEqual([])
    expect(sanitizeSongAttachments(null)).toEqual([])
    expect(sanitizeSongAttachments("nope")).toEqual([])
    expect(sanitizeSongAttachments({})).toEqual([])
  })

  it("keeps a well-formed entry intact", () => {
    const [entry] = sanitizeSongAttachments([fileEntry()])
    expect(entry).toBeDefined()
    expect(entry?.id).toBe("att_1")
    expect(entry?.kind).toBe("file")
    expect(entry?.name).toBe("Chart")
    expect(entry?.note).toBe("Bb")
    expect(entry?.size).toBe(2048)
    expect(entry?.path).toContain("attachments/alice")
    expect(entry?.uploadedByName).toBe("Alice")
  })

  it("drops entries with no openable URL (missing, empty or an unsafe scheme)", () => {
    expect(sanitizeSongAttachments([fileEntry({ url: undefined })])).toEqual([])
    expect(sanitizeSongAttachments([fileEntry({ url: "" })])).toEqual([])
    expect(sanitizeSongAttachments([fileEntry({ url: "javascript:alert(1)" })])).toEqual([])
    expect(sanitizeSongAttachments([42, "nope", null])).toEqual([])
  })

  it("gives a healed entry the id its position guarantees", () => {
    const entries = sanitizeSongAttachments([fileEntry({ id: "" }), fileEntry({ id: undefined })])
    expect(entries.map((entry) => entry.id)).toEqual(["att_0", "att_1"])
  })

  it("reads an unknown kind from the path, and never keeps a path on a link", () => {
    const [healedFile] = sanitizeSongAttachments([
      fileEntry({ kind: "someday" as SongAttachment["kind"] }),
    ])
    expect(healedFile?.kind).toBe("file")
    expect(healedFile?.path).toContain("attachments/alice")

    const [link] = sanitizeSongAttachments([
      fileEntry({ kind: "link", url: "https://drive.google.com/file/d/1", path: "should/not/stick" }),
    ])
    expect(link?.kind).toBe("link")
    expect(link?.path).toBe("")
    expect(link?.size).toBe(0)
  })

  it("collapses and clamps the name, deriving one when it is empty", () => {
    const [messy] = sanitizeSongAttachments([fileEntry({ name: "  Chart   in\n Bb  " })])
    expect(messy?.name).toBe("Chart in Bb")

    const [overlong] = sanitizeSongAttachments([fileEntry({ name: "x".repeat(500) })])
    expect(overlong?.name).toHaveLength(ATTACHMENT_NAME_MAX)

    const [derivedFromPath] = sanitizeSongAttachments([fileEntry({ name: "" })])
    expect(derivedFromPath?.name).toBe("att_1")

    const [derivedFromHost] = sanitizeSongAttachments([
      fileEntry({ kind: "link", name: "", url: "https://www.youtube.com/watch?v=abc", path: "" }),
    ])
    expect(derivedFromHost?.name).toBe("youtube.com")

    const [dashes] = sanitizeSongAttachments([fileEntry({ name: "", url: "https://", path: "" })])
    expect(dashes?.name).toBe("—")
  })

  it("trims and clamps the note", () => {
    const [note] = sanitizeSongAttachments([fileEntry({ note: `  ${"n".repeat(500)}  ` })])
    expect(note?.note).toHaveLength(ATTACHMENT_NOTE_MAX)

    const [clean] = sanitizeSongAttachments([fileEntry({ note: 12345 as unknown as string })])
    expect(clean?.note).toBe("")
  })

  it("normalises size and refuses it on links", () => {
    const [bad] = sanitizeSongAttachments([fileEntry({ size: Number.NaN })])
    expect(bad?.size).toBe(0)

    const [negative] = sanitizeSongAttachments([fileEntry({ size: -10 })])
    expect(negative?.size).toBe(0)

    const [fractional] = sanitizeSongAttachments([fileEntry({ size: 2048.7 })])
    expect(fractional?.size).toBe(2049)
  })

  it("caps the list at the rule's limit", () => {
    const many = Array.from({ length: MAX_SONG_ATTACHMENTS + 5 }, (_, index) =>
      fileEntry({ id: `att_${index}` }),
    )
    expect(sanitizeSongAttachments(many)).toHaveLength(MAX_SONG_ATTACHMENTS)
  })

  it("keeps a stored stamp and nulls a missing one", () => {
    const [stamped] = sanitizeSongAttachments([fileEntry()])
    expect(stamped?.uploadedAt).toBeInstanceOf(Date)

    const [bare] = sanitizeSongAttachments([fileEntry({ uploadedAt: undefined })])
    expect(bare?.uploadedAt).toBeNull()
  })
})

describe("attachment helpers", () => {
  it("strips directories and the .pdf extension", () => {
    expect(attachmentBaseName("charts/My Song.PDF")).toBe("My Song")
    expect(attachmentBaseName("chart.pdf")).toBe("chart")
    expect(attachmentBaseName("partitura en si.pdf")).toBe("partitura en si")
  })

  it("accepts only .pdf names, in any case", () => {
    expect(isPdfFileName("chart.pdf")).toBe(true)
    expect(isPdfFileName("CHART.PDF ")).toBe(true)
    expect(isPdfFileName("chart.txt")).toBe(false)
    expect(isPdfFileName("chart")).toBe(false)
  })

  it("extracts the host without the scheme, www or the path", () => {
    expect(linkHost("https://www.drive.google.com/file/d/1")).toBe("drive.google.com")
    expect(linkHost("http://youtube.com/watch?v=abc&t=1")).toBe("youtube.com")
    expect(linkHost("https://open.spotify.com/track/xyz")).toBe("open.spotify.com")
  })

  it("formats bytes as KB or MB, never below 1 KB", () => {
    expect(attachmentSize(2048)).toEqual({ key: SONG_ATTACHMENT_SIZE_KEYS.kb, value: "2" })
    expect(attachmentSize(1024 * 1024 + 512 * 1024)).toEqual({
      key: SONG_ATTACHMENT_SIZE_KEYS.mb,
      value: "1.5",
    })
    expect(attachmentSize(0)).toEqual({ key: SONG_ATTACHMENT_SIZE_KEYS.kb, value: "1" })
    expect(attachmentSize(-5)).toEqual({ key: SONG_ATTACHMENT_SIZE_KEYS.kb, value: "1" })
    expect(attachmentSize(Number.NaN)).toEqual({ key: SONG_ATTACHMENT_SIZE_KEYS.kb, value: "1" })
  })

  it("ships both size keys in both locales (the formatter never builds strings)", () => {
    // The keys are full `t()` keys ("attachments.sizeKb") while the files hold
    // them under their namespace — strip the prefix to index into the object.
    const subKey = (key: string): string => key.slice("attachments.".length)
    for (const file of ["locales/en.json", "locales/es.json"]) {
      const locale = JSON.parse(readFileSync(file, "utf8")) as Record<string, Record<string, string>>
      expect(locale.attachments?.[subKey(SONG_ATTACHMENT_SIZE_KEYS.kb)]).toBeDefined()
      expect(locale.attachments?.[subKey(SONG_ATTACHMENT_SIZE_KEYS.mb)]).toBeDefined()
    }
  })
})

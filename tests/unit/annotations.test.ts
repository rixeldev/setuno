import { describe, expect, it } from "vitest"

import {
  ANNOTATION_MARKERS_LIMIT,
  addMarker,
  annotationFromData,
  canAddMarker,
  clampMarkerText,
  isEmptyAnnotation,
  markerAnchorLabel,
  markerPlacements,
  markersOfSong,
  removeMarker,
  sortMarkerPlacements,
  updateMarkerText,
} from "@/libs/annotations"
import type { SongSection } from "@/interfaces"

const section = (id: string, lines: number): SongSection => ({
  id,
  type: "verse",
  label: "",
  lines: Array.from({ length: lines }, (_, index) => ({ text: `line ${index + 1}`, chords: [] })),
})

/** Fake English template for the one interpolated key the helper builds. */
const TEMPLATES: Record<string, string> = {
  "annotations.lineAnchor": "{{section}} · line {{line}}",
  "annotations.removedAnchor": "removed section",
}

/** `t` stub: resolves a fake template and interpolates `{{name}}`. */
const translate = (key: string, args?: Record<string, unknown>): string => {
  const template = TEMPLATES[key] ?? key
  if (!args) return template
  return Object.entries(args).reduce(
    (out, [name, value]) => out.replaceAll(`{{${name}}}`, String(value)),
    template,
  )
}

describe("annotationFromData", () => {
  it("reads notes and markers from a raw document", () => {
    const data = {
      notes: " tune down",
      markers: [
        { id: "m1", sectionId: "secA", lineIndex: 2, text: "I come in here" },
        { id: "m2", sectionId: "secB", lineIndex: -1, text: "second chorus only" },
      ],
      updatedAt: { seconds: 1, nanoseconds: 2 },
    }
    const annotation = annotationFromData(data)
    expect(annotation.notes).toBe(" tune down")
    expect(annotation.markers).toHaveLength(2)
    expect(annotation.markers[0]).toEqual({ id: "m1", sectionId: "secA", lineIndex: 2, text: "I come in here" })
    expect(annotation.updatedAt?.seconds).toBe(1)
  })

  it("drops malformed markers and clamps oversized text", () => {
    const data = {
      notes: "x".repeat(5000),
      markers: [
        { lineIndex: 0, text: "no id, no section" },
        { id: "gone", sectionId: "secA", lineIndex: 0, text: "   " },
        { id: "ok", sectionId: "secA", lineIndex: 0, text: "y".repeat(2000) },
        "not a marker",
      ],
    }
    const annotation = annotationFromData(data)
    expect(annotation.notes).toHaveLength(2000)
    expect(annotation.markers).toHaveLength(1)
    expect(annotation.markers[0].id).toBe("ok")
    expect(annotation.markers[0].text).toHaveLength(500)
  })
})

describe("marker creation and editing", () => {
  const base = { sectionId: "secA", lineIndex: 1, text: "note" } as const

  it("appends a trimmed, clamped marker", () => {
    const markers = addMarker([], { ...base, text: "  hello there  " })
    expect(markers).toHaveLength(1)
    expect(markers[0].text).toBe("hello there")
    expect(markers[0].sectionId).toBe("secA")
    expect(markers[0].lineIndex).toBe(1)
    expect(markers[0].id.length).toBeGreaterThan(0)
  })

  it("refuses empty notes and returns the same list", () => {
    const markers = [{ id: "a", sectionId: "sec", lineIndex: 0, text: "existing" }]
    expect(addMarker(markers, { ...base, text: "   " })).toBe(markers)
  })

  it("refuses a marker without an anchor section", () => {
    const markers = [{ id: "a", sectionId: "sec", lineIndex: 0, text: "existing" }]
    expect(addMarker(markers, { ...base, sectionId: "", text: "unanchored" })).toBe(markers)
  })

  it("respects the per-song marker limit", () => {
    let markers = Array.from({ length: ANNOTATION_MARKERS_LIMIT }, (_, index) => ({
      id: `m${index}`,
      sectionId: "sec",
      lineIndex: 0,
      text: `note ${index}`,
    }))
    expect(canAddMarker(markers)).toBe(false)
    markers = addMarker(markers, base)
    expect(markers).toHaveLength(ANNOTATION_MARKERS_LIMIT)
  })

  it("updates one marker's text", () => {
    const markers = [
      { id: "a", sectionId: "sec", lineIndex: 0, text: "old" },
      { id: "b", sectionId: "sec", lineIndex: 1, text: "keep" },
    ]
    const next = updateMarkerText(markers, "a", "  new  ")
    expect(next[0].text).toBe("new")
    expect(next[1].text).toBe("keep")
    expect(updateMarkerText(markers, "missing", "new")).toBe(markers)
    expect(updateMarkerText(markers, "a", "  ")).toBe(markers)
  })

  it("removes one marker", () => {
    const markers = [{ id: "a", sectionId: "sec", lineIndex: 0, text: "x" }]
    expect(removeMarker(markers, "a")).toEqual([])
    expect(removeMarker(markers, "missing")).toBe(markers)
  })

  it("clamps marker text to the rules limit", () => {
    expect(clampMarkerText("z".repeat(600))).toHaveLength(500)
  })
})

describe("isEmptyAnnotation", () => {
  it("treats missing, empty and whitespace-only annotations as empty", () => {
    expect(isEmptyAnnotation(null)).toBe(true)
    expect(isEmptyAnnotation({ notes: "", markers: [] })).toBe(true)
    expect(isEmptyAnnotation({ notes: "  ", markers: [] })).toBe(true)
    expect(isEmptyAnnotation({ notes: "", markers: [{ id: "a", sectionId: "s", lineIndex: 0, text: "x" }] })).toBe(false)
    expect(isEmptyAnnotation({ notes: "hi", markers: [] })).toBe(false)
  })
})

describe("marker placement", () => {
  const sections = [section("secA", 3), section("secB", 2)]

  it("resolves section indexes and sorts by section then line", () => {
    const markers = [
      { id: "m1", sectionId: "secB", lineIndex: 1, text: "b1" },
      { id: "m2", sectionId: "secA", lineIndex: 2, text: "a2" },
      { id: "m3", sectionId: "secA", lineIndex: 0, text: "a0" },
      { id: "m4", sectionId: "secMissing", lineIndex: -1, text: "gone" },
    ]
    const placements = sortMarkerPlacements(markerPlacements(markers, sections))
    expect(placements.map((entry) => entry.marker.id)).toEqual(["m3", "m2", "m1", "m4"])
    expect(placements[3].sectionIndex).toBe(-1)
  })

  it("classifies markers onto lines or whole sections", () => {
    const markers = [
      { id: "line", sectionId: "secA", lineIndex: 1, text: "on a line" },
      { id: "whole", sectionId: "secA", lineIndex: -1, text: "whole section" },
      { id: "stale", sectionId: "secA", lineIndex: 99, text: "line moved away" },
      { id: "missing", sectionId: "secGone", lineIndex: -1, text: "section deleted" },
    ]
    const boards = markersOfSong(markers, sections)
    expect(boards.byLine.get("secA:1")?.map((marker) => marker.id)).toEqual(["line"])
    expect(boards.bySection.get("secA")?.map((marker) => marker.id).sort()).toEqual(["stale", "whole"])
    expect(boards.bySection.get("secGone")).toBeUndefined()
    expect(boards.byLine.get("secB:0")).toBeUndefined()
  })
})

describe("markerAnchorLabel", () => {
  const sections = [section("verse1", 4), section("chorus2", 2)]

  it("combines the section label and the 1-based line", () => {
    const label = markerAnchorLabel(
      { id: "m", sectionId: "verse1", lineIndex: 2, text: "x" },
      sections,
      translate,
    )
    expect(label).toContain("line 3")
  })

  it("uses the section label alone for whole-section markers", () => {
    const label = markerAnchorLabel(
      { id: "m", sectionId: "chorus2", lineIndex: -1, text: "x" },
      sections,
      translate,
    )
    expect(label.startsWith("annotations.lineAnchor")).toBe(false)
    expect(label).not.toContain("line ")
  })

  it("falls back when the anchor no longer exists", () => {
    const label = markerAnchorLabel(
      { id: "m", sectionId: "gone", lineIndex: 0, text: "x" },
      sections,
      translate,
    )
    expect(label).toBe("removed section")
  })
})
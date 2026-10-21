// Keeps the Google Play metadata honest about Play's character limits.
//
// The listing and the release notes are pasted into the Play Console by hand,
// so a block that grows past the limit fails at the worst possible moment (in
// the console, mid-release). This script recounts every field and rewrites the
// counter in its header; `--check` only verifies, for a future CI step.
//
//   node scripts/playListingCounts.mjs          # recount and write
//   node scripts/playListingCounts.mjs --check  # verify only, exit 1 on overflow
//
// Counts are Unicode code points, which is what Play sees: an accented letter
// or an emoji is one character, not a byte.

import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const LISTING = "docs/store/google-play-listing.md"
const NOTES = "docs/store/google-play-release-notes.md"

/** Play's own caps, in characters. */
const LIMITS = { title: 30, short: 80, full: 4000, notes: 500 }

const checkOnly = process.argv.includes("--check")

const characters = (value) => [...value].length

/** The line that carries a counter, in any of the four languages. */
const TITLE = /^(TÍTULO|TITLE|TITRE) \((\d+)\/(\d+)\)$/
const SHORT =
  /^(DESCRIPCIÓN CORTA|SHORT DESCRIPTION|DESCRIÇÃO CURTA|COURTE DESCRIPTION) \((\d+)\/(\d+)\)$/
const FULL =
  /^(DESCRIPCIÓN COMPLETA|FULL DESCRIPTION|DESCRIÇÃO COMPLETA|DESCRIPTION COMPLÈTE) \((\d+)\/(\d+)\)$/
const SEPARATOR = /^=+$/
const LANGUAGE_HEADER = /^(.*\(([a-z]{2}(?:-[A-Za-z0-9]+)?)\))\s*—\s*\d+\/\d+$/

const read = (file) => readFileSync(path.join(root, file), "utf8")

/**
 * Reads one field: the next non-empty line for a title/short description, or
 * everything up to the next `===` separator (trimmed) for a full one.
 */
function readField(lines, index, multiline) {
  if (!multiline) {
    let cursor = index + 1
    while (cursor < lines.length && lines[cursor].trim() === "") cursor += 1
    return lines[cursor].trim()
  }
  let end = index + 1
  while (end < lines.length && !SEPARATOR.test(lines[end])) end += 1
  return lines.slice(index + 1, end).join("\n").trim()
}

/** Every listing field with its header line and its measured length. */
function listingFields(text) {
  const lines = text.split("\n")
  const fields = []
  lines.forEach((line, index) => {
    const title = TITLE.exec(line)
    const short = SHORT.exec(line)
    const full = FULL.exec(line)
    const match = title ?? short ?? full
    if (!match) return
    const kind = title ? "title" : short ? "short" : "full"
    const prefix = line.slice(0, line.lastIndexOf("("))
    fields.push({
      index,
      kind,
      prefix,
      cap: Number(match[3]),
      value: readField(lines, index, kind === "full"),
    })
  })
  return fields
}

/** Every `<lang>…</lang>` block, paired with the language header above it. */
function noteBlocks(text) {
  const blocks = []
  const pattern = /<([a-z]{2}(?:-[A-Za-z0-9]+)?)>\n([\s\S]*?)\n<\/\1>/g
  for (const match of text.matchAll(pattern)) {
    const start = text.slice(0, match.index).split("\n").length - 1
    blocks.push({
      code: match[1],
      value: match[2].trim(),
      startLine: start,
    })
  }
  const lines = text.split("\n")
  return blocks.map((block) => {
    let header = -1
    for (let index = block.startLine - 1; index >= 0; index -= 1) {
      const match = LANGUAGE_HEADER.exec(lines[index])
      if (match && match[2] === block.code) {
        header = index
        break
      }
    }
    const match = header >= 0 ? LANGUAGE_HEADER.exec(lines[header]) : null
    return {
      ...block,
      header,
      cap: LIMITS.notes,
      prefix: match ? match[1] : null,
    }
  })
}

const failures = []
const report = []

function measure(file, fields, kind) {
  const lines = read(file).split("\n")
  let next = [...lines]
  for (const field of fields) {
    const count = characters(field.value)
    const ok = count <= field.cap
    if (!ok) failures.push(`${file}: ${field.prefix ?? field.code} ${count}/${field.cap}`)
    report.push({
      file: path.basename(file),
      label: field.prefix ?? `${field.code}`,
      kind,
      count,
      cap: field.cap,
      ok,
    })
    if (field.index !== undefined && !checkOnly) {
      next[field.index] = `${field.prefix}(${count}/${field.cap})`
    }
    if (field.header !== undefined && field.header >= 0 && !checkOnly && field.prefix) {
      next[field.header] = `${field.prefix} — ${count}/${field.cap}`
    }
  }
  if (!checkOnly) writeFileSync(path.join(root, file), next.join("\n"), "utf8")
}

measure(LISTING, listingFields(read(LISTING)), "listing")
measure(NOTES, noteBlocks(read(NOTES)), "notes")

const width = Math.max(...report.map((row) => row.label.length))
for (const row of report) {
  const status = row.ok ? "ok" : "OVER"
  console.log(
    `${row.file.padEnd(32)} ${row.label.padEnd(width)} ${String(row.count).padStart(5)}/${String(row.cap).padEnd(5)} ${status}`,
  )
}

if (failures.length > 0) {
  console.error(`\n${failures.length} field(s) past Play's limit:`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}

console.log(checkOnly ? "\nAll fields fit Play's limits." : "\nCounters rewritten.")

import { isRecognizedChord } from "@/libs/chords"

/**
 * The metadata a pasted sheet may carry (roadmap #19 and #87).
 *
 * A chord sheet pasted from a website usually opens with a few lines that are
 * not lyrics: the key, the capo, the tempo, the tuning. Both the paste parser
 * and the photo importer need to tell those apart from a lyric, and both need
 * to read what they say — so the reading lives here, once.
 */

/** What a metadata line says. */
export interface LyricMeta {
  /** The key, when the line declares one the songbook can read. */
  key: string | null
  /** The capo, when the line declares one. */
  capo: number | null
  /** The tempo, when the line declares one. */
  bpm: number | null
}

const KEY_PATTERN = /^(?:key|tone|tonality)\s*(?:of\s+)?[:=]?\s*(.+)$/i
const CAPO_PATTERN = /^capo\s*[:=]?\s*(\d{1,2})$/i
const BPM_PATTERN = /^(?:tempo|bpm)\s*[:=]?\s*(\d{2,3})$/i
const BPM_SUFFIX_PATTERN = /^(\d{2,3})\s*bpm$/i
const TUNING_PATTERN = /^tuning\s*[:=]/i

/** The key as it is written, without the punctuation a paste adds. */
export const cleanKey = (raw: string): string =>
  raw
    .trim()
    .replace(/[.,;:!?'"()[\]]+$/g, "")
    .trim()

/**
 * Reads a metadata line, or `null` when the line is not metadata at all.
 *
 * A line that says something the songbook cannot read ("Key: E major") is
 * still metadata — it is dropped, but it is not mistaken for a lyric.
 */
export const readLyricMeta = (text: string): LyricMeta | null => {
  const trimmed = text.trim()
  if (trimmed.length === 0) return null

  const capo = CAPO_PATTERN.exec(trimmed)
  if (capo) return { key: null, capo: Number(capo[1]), bpm: null }

  const bpm = BPM_PATTERN.exec(trimmed) ?? BPM_SUFFIX_PATTERN.exec(trimmed)
  if (bpm) return { key: null, capo: null, bpm: Number(bpm[1]) }

  const key = KEY_PATTERN.exec(trimmed)
  if (key) {
    const value = cleanKey(key[1] ?? "")
    return { key: isRecognizedChord(value) && !value.includes("/") ? value : null, capo: null, bpm: null }
  }

  if (TUNING_PATTERN.test(trimmed)) return { key: null, capo: null, bpm: null }

  return null
}

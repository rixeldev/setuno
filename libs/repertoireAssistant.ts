import { clampGoalMinutes, MAX_BREAK_MINUTES, MAX_GOAL_MINUTES } from "@/libs/setlistDuration"
import type { SongUsage } from "@/libs/songUsage"

/**
 * The repertoire assistant (roadmap #86): a **deterministic** draft running
 * order.
 *
 * The roadmap asks for the draft to come from three things, and this is where
 * each one lands:
 *
 * - **The duration goal** (#42) — the slot is the target and the break eats
 *   into it, exactly like the setlist's own readout, so the assistant fills
 *   the same number the band is looking at.
 * - **Rotation** (#44) — the songs the band has played least come first into
 *   the draft, so a set revives what it has been neglecting. The comparison is
 *   #44's own: a played song before a never-played one, the most neglected
 *   first — reviving known material beats debuting untested songs.
 * - **Energy** — the tempo, which is the only energy the app knows. The draft
 *   is arranged in a **tent**: it warms up, peaks in the middle and cools down
 *   again, so the set has a shape instead of being a list of songs.
 *
 * Nothing is stored and no model is involved: the same band and the same
 * songs always produce the same draft, on every device. The model-based
 * version the roadmap keeps in reserve is only worth building if this
 * disappoints.
 */

/** A song the assistant can pick, reduced to what it actually needs. */
export interface RepertoireSong {
  id: string
  title: string
  /** Beats per minute — the energy proxy. `null` when nobody set one. */
  bpm: number | null
  /** The song's length; `null` when nothing is known about it. */
  durationSec: number | null
}

/** The slot the assistant aims at when the band did not set one. */
export const ASSISTANT_DEFAULT_MINUTES = 45

/** A draft never grows past this, however long the slot is. */
export const ASSISTANT_MAX_SONGS = 30

/** The length assumed for a song whose duration nobody knows (3½ minutes). */
export const ASSISTANT_FALLBACK_SEC = 210

/** The tempo range the energy is read over. */
const ENERGY_MIN_BPM = 60
const ENERGY_MAX_BPM = 160

/** What the assistant produced. */
export interface RepertoireDraft {
  /** The songs to add, in running order. */
  songIds: string[]
  /** The music the draft adds, in seconds. */
  addedSec: number
  /** The slot the draft aimed at, in seconds (0 = no goal at all). */
  goalSec: number
  /** True when the draft filled the slot (or there was no slot to fill). */
  reachedGoal: boolean
  /** Candidates the slot had no room for. */
  skipped: number
}

export interface RepertoireDraftInput {
  /** The songs the assistant may pick — the caller filters retired ones out. */
  songs: readonly RepertoireSong[]
  /** The usage map (#34) — nothing else knows which songs are neglected. */
  usage: ReadonlyMap<string, SongUsage>
  /** The songs already in the list: never picked again. */
  existingSongIds?: readonly string[]
  /** The music the list already holds, in seconds. */
  existingSec?: number
  /** The slot, in minutes (#42's target). Zero means "use the default". */
  targetMinutes?: number
  /** The break inside that slot, in minutes (#42). */
  breakMinutes?: number
}

/** The length a song counts as. */
const lengthOf = (song: RepertoireSong): number =>
  song.durationSec !== null && song.durationSec > 0 ? song.durationSec : ASSISTANT_FALLBACK_SEC

/**
 * The song's energy, 0 (calm) to 1 (driving).
 *
 * A song with no tempo is **neutral** (0.5), not calm and not driving: an
 * unknown tempo is an absence, and pretending it is a slow ballad would put
 * it in the wrong place of the arc.
 */
const energyOf = (song: RepertoireSong): number => {
  if (song.bpm === null || song.bpm <= 0) return 0.5
  const bpm = Math.min(Math.max(song.bpm, ENERGY_MIN_BPM), ENERGY_MAX_BPM)
  return (bpm - ENERGY_MIN_BPM) / (ENERGY_MAX_BPM - ENERGY_MIN_BPM)
}

/** A candidate with the numbers the ranking needs. */
interface Ranked {
  song: RepertoireSong
  /** Completed events since it was last played (`null`: never played). */
  eventsAgo: number | null
  timesPlayed: number
}

/**
 * The candidates, ranked the way #44 ranks them: a song the band has played
 * comes before one it never has, the most neglected first, then the least
 * played, then the title and the id — so the same band always gets the same
 * order.
 *
 * The rotation chip (#44) *filters* to the neglected songs; the assistant
 * cannot, because it has to fill a slot whatever the band's history says. So
 * the same comparison is used here without the filter: the neglected songs
 * come first and the ones played last week come last, and a never-played
 * song sits between them (#44's own rule — reviving known material beats
 * debuting untested songs).
 */
const rank = (
  songs: readonly RepertoireSong[],
  usage: ReadonlyMap<string, SongUsage>,
): Ranked[] => {
  const ranked = songs.map<Ranked>((song) => {
    const entry = usage.get(song.id)
    return {
      song,
      eventsAgo: entry?.eventsAgo ?? null,
      timesPlayed: entry?.timesPlayed ?? 0,
    }
  })
  ranked.sort((a, b) => {
    const aPlayed = a.eventsAgo !== null
    const bPlayed = b.eventsAgo !== null
    if (aPlayed !== bPlayed) return aPlayed ? -1 : 1
    if (a.eventsAgo !== b.eventsAgo) return (b.eventsAgo ?? 0) - (a.eventsAgo ?? 0)
    if (a.timesPlayed !== b.timesPlayed) return a.timesPlayed - b.timesPlayed
    return a.song.title.localeCompare(b.song.title) || a.song.id.localeCompare(b.song.id)
  })
  return ranked
}

/**
 * The energy the running order wants at each position: a tent, peaking in
 * the middle. `sin` gives a symmetric curve whose peak really is 1 (a
 * triangle would top out at `1 - 1/n` and flatten the middle of a long set).
 */
const targetEnergy = (position: number, total: number): number =>
  Math.sin((Math.PI * (position + 0.5)) / total)

/**
 * Arranges the chosen songs along the tent: the most driving song takes the
 * peak, the calmest ones take the ends.
 *
 * Both sides are sorted with an explicit index tiebreak (not relying on the
 * engine's stable sort), so the arrangement is the same everywhere.
 */
const arrange = (songs: readonly RepertoireSong[]): string[] => {
  const total = songs.length
  if (total === 0) return []
  const byEnergy = songs
    .map((song, index) => ({ song, index, energy: energyOf(song) }))
    .sort((a, b) => b.energy - a.energy || a.index - b.index)
  const positions = songs
    .map((_, index) => ({ index, target: targetEnergy(index, total) }))
    .sort((a, b) => b.target - a.target || a.index - b.index)
  const arranged: (string | null)[] = new Array(total).fill(null)
  positions.forEach((position, order) => {
    arranged[position.index] = byEnergy[order]?.song.id ?? null
  })
  return arranged.filter((id): id is string => id !== null)
}

/**
 * Builds the draft.
 *
 * The slot is the goal **minus the break** (#42's own maths), and the music
 * the list already holds counts towards it — a goal is for the whole set, not
 * for what is still missing. The draft stops as soon as the slot is full, so
 * a song that does not fit is simply left out; the setlist's own readout says
 * afterwards whether the goal was reached or overshot.
 */
export const buildRepertoireDraft = (input: RepertoireDraftInput): RepertoireDraft => {
  const existing = new Set(input.existingSongIds ?? [])
  const pool = input.songs.filter((song) => !existing.has(song.id))
  const ranked = rank(pool, input.usage)

  const target = clampGoalMinutes(input.targetMinutes ?? 0, MAX_GOAL_MINUTES)
  const minutes = target > 0 ? target : ASSISTANT_DEFAULT_MINUTES
  const breakMinutes = clampGoalMinutes(input.breakMinutes ?? 0, MAX_BREAK_MINUTES)
  const goalSec = Math.max(0, minutes * 60 - breakMinutes * 60)
  const existingSec = Math.max(0, input.existingSec ?? 0)

  const chosen: RepertoireSong[] = []
  let addedSec = 0
  for (const candidate of ranked) {
    if (chosen.length >= ASSISTANT_MAX_SONGS) break
    if (existingSec + addedSec >= goalSec) break
    chosen.push(candidate.song)
    addedSec += lengthOf(candidate.song)
  }

  return {
    songIds: arrange(chosen),
    addedSec,
    goalSec,
    reachedGoal: goalSec === 0 || existingSec + addedSec >= goalSec,
    skipped: ranked.length - chosen.length,
  }
}

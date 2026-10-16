import { useSyncExternalStore } from "react"

import type { ShowLogEntry, ShowOutcome } from "@/interfaces/performance"
import {
  ensureShowEntry,
  markShowOutcome,
  recordVisitSeconds,
  sanitizeShowLog,
  visitSeconds,
  type ShowBreakWindow,
} from "@/libs/showLog"

/**
 * Session state shared while stepping through an event's setlist in the song
 * reader. Each step opens a fresh screen (the reader route is replaced), so:
 *
 * - the last transition direction lives here, letting the stack animate
 *   forwards ("push") or backwards ("pop") depending on the arrow pressed;
 * - stage mode lives here too, so switching songs keeps the reader fullscreen
 *   instead of dropping back to the regular layout;
 * - the live show clock (roadmap #7) lives here as well: the start time and the
 *   break countdown survive the step to the next song and stay in memory — the
 *   **clock** is never written to Firebase;
 * - so does the show **log** (roadmap #45): which song is on the clock right
 *   now, every mark (played/skipped/improvised) and each song's measured
 *   seconds. Unlike the clock, the log *is* persisted — `hooks/useShowLogSync`
 *   writes it to the event document on every change, so the post-gig report
 *   opens filled in and a killed app cannot lose the night. A visit that is
 *   still open is committed on stop, release or the next arrival, with break
 *   time excluded (`libs/showLog.ts#visitSeconds`).
 */

export type ReaderDirection = "push" | "pop"

let direction: ReaderDirection = "push"
const directionListeners = new Set<() => void>()

export const setReaderDirection = (next: ReaderDirection): void => {
  if (next === direction) return
  direction = next
  directionListeners.forEach((listener) => listener())
}

/** Read by the (app) stack to animate the reader's replace transitions. */
export const useReaderDirection = (): ReaderDirection =>
  useSyncExternalStore(
    (listener) => {
      directionListeners.add(listener)
      return () => {
        directionListeners.delete(listener)
      }
    },
    () => direction,
    () => direction,
  )

let immersive = false

/** Stage mode is only restored when the reader opens inside a setlist. */
export const readImmersiveMode = (): boolean => immersive

export const writeImmersiveMode = (next: boolean): void => {
  immersive = next
}

/** The live show a reader session is running, if any (roadmap #7). */
export interface LiveShowSession {
  /** Setlist the show was started from; null while no show is running. */
  setlistId: string | null
  /** Epoch ms the show started; null while no show is running. */
  startedAt: number | null
  /** Epoch ms the break ends; null when the band is not on a break. */
  breakUntil: number | null
  /**
   * Outcome/time log for this show (roadmap #45). Seeded from the event's
   * stored log on start (the report's marks survive a restart), kept after
   * stop — the final write must see it — and replaced by the next show's seed.
   */
  log: ShowLogEntry[]
  /** Song being timed right now; null between songs, on breaks and when idle. */
  visit: { songId: string; enteredAt: number } | null
  /** Break windows, so break minutes never land on a song's clock. */
  breaks: ShowBreakWindow[]
}

const IDLE_SHOW: LiveShowSession = {
  setlistId: null,
  startedAt: null,
  breakUntil: null,
  log: [],
  visit: null,
  breaks: [],
}

let liveShow: LiveShowSession = IDLE_SHOW
const showListeners = new Set<() => void>()

const notifyShow = (): void => {
  showListeners.forEach((listener) => listener())
}

/** Current live show, or the idle value when the band is not playing one. */
export const readLiveShow = (): LiveShowSession => liveShow

/** Subscribes to show changes (clock, breaks and log); returns the unsubscribe. */
export const subscribeLiveShow = (listener: () => void): (() => void) => {
  showListeners.add(listener)
  return () => {
    showListeners.delete(listener)
  }
}

/** Closes the open visit, banking its seconds on the song's log entry. */
const commitVisit = (session: LiveShowSession, now: number): LiveShowSession => {
  const visit = session.visit
  if (!visit) return session
  return {
    ...session,
    log: recordVisitSeconds(
      session.log,
      visit.songId,
      visitSeconds(visit.enteredAt, now, session.breaks),
      now,
    ),
    visit: null,
  }
}

/**
 * Starts (or restarts) the show clock for one setlist. The log is seeded from
 * the event's stored one (so the report's marks and notes survive) and the
 * first song on screen starts its clock right away.
 */
export const startLiveShow = (
  setlistId: string,
  options: {
    startedAt?: number
    seed?: readonly ShowLogEntry[]
    firstSongId?: string | null
  } = {},
): void => {
  const startedAt = options.startedAt ?? Date.now()
  const seeded = sanitizeShowLog(options.seed ?? [])
  const firstSongId = options.firstSongId ?? null
  liveShow = {
    setlistId,
    startedAt,
    breakUntil: null,
    log: firstSongId ? ensureShowEntry(seeded, firstSongId, startedAt) : seeded,
    visit: firstSongId ? { songId: firstSongId, enteredAt: startedAt } : null,
    breaks: [],
  }
  notifyShow()
}

/**
 * Ends the show: the open visit is committed and the clock forgotten, but the
 * log **stays** — it is what the final persist and this device's report read.
 * The next `startLiveShow` replaces it with the stored seed.
 */
export const stopLiveShow = (now: number = Date.now()): void => {
  liveShow = { ...commitVisit(liveShow, now), startedAt: null, breakUntil: null }
  notifyShow()
}

/**
 * Remembers the song being read while the show runs, opening its visit (the
 * previous song's is committed first). No-op outside a running show for that
 * very setlist — opening a song from the songbook mid-show touches nothing.
 */
export const touchShowSong = (
  setlistId: string,
  songId: string,
  now: number = Date.now(),
): void => {
  if (liveShow.setlistId !== setlistId || liveShow.startedAt === null) return
  if (liveShow.visit?.songId === songId) return
  liveShow = {
    ...commitVisit(liveShow, now),
    log: ensureShowEntry(liveShow.log, songId, now),
    visit: { songId, enteredAt: now },
  }
  notifyShow()
}

/**
 * Closes a song's visit when its reader unmounts, so stepping away from the
 * reader mid-show stops the clock instead of banking the hallway time. Only
 * closes the visit of *that* song, so the replace-swap (new screen mounting
 * before or after the old one unmounts) can never kill the fresh visit.
 */
export const releaseShowSong = (
  setlistId: string,
  songId: string,
  now: number = Date.now(),
): void => {
  if (liveShow.setlistId !== setlistId) return
  if (liveShow.visit?.songId !== songId) return
  liveShow = commitVisit(liveShow, now)
  notifyShow()
}

/** Marks the song on screen with the outcome the band chose (roadmap #45). */
export const markShowSong = (
  setlistId: string,
  outcome: ShowOutcome,
  now: number = Date.now(),
): void => {
  if (liveShow.setlistId !== setlistId || liveShow.startedAt === null) return
  const songId = liveShow.visit?.songId
  if (!songId) return
  liveShow = { ...liveShow, log: markShowOutcome(liveShow.log, songId, outcome, now) }
  notifyShow()
}

/** Starts a break that lasts `seconds` from now. */
export const startBreak = (seconds: number, now: number = Date.now()): void => {
  const until = now + Math.max(0, seconds) * 1000
  liveShow = {
    ...liveShow,
    breakUntil: until,
    breaks: [...liveShow.breaks, { start: now, until, end: null }],
  }
  notifyShow()
}

/** Ends the break early (or when the countdown reaches zero). */
export const endBreak = (now: number = Date.now()): void => {
  liveShow = {
    ...liveShow,
    breakUntil: null,
    // Only the open window closes: an already-ended break keeps its real end.
    breaks: liveShow.breaks.map((window) => (window.end === null ? { ...window, end: now } : window)),
  }
  notifyShow()
}

/** Live show clock; re-renders on every start/stop/break change. */
export const useLiveShow = (): LiveShowSession =>
  useSyncExternalStore(subscribeLiveShow, readLiveShow, readLiveShow)

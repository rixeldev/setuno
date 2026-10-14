import { useCallback, useEffect, useRef, useState } from "react"
import type { ScrollView } from "react-native"

import {
  autoscrollPixelsPerSecond,
  lyricRowHeight,
  maxScrollOffset,
  scrollProgress,
  type AutoscrollStatus,
} from "@/libs/autoscroll"

/** What the reader renders: transport state plus the handlers it wires up. */
export interface AutoscrollController {
  status: AutoscrollStatus
  /** Seconds left of the start countdown (0 while it is not running). */
  countdown: number
  /** 0..1 of the scrollable range already travelled. */
  progress: number
  /** Seconds left to reach the bottom at the current speed (`null`: unknown). */
  remainingSeconds: number | null
  /** False when the lyrics already fit on screen: nothing to scroll. */
  canScroll: boolean
  /** Starts (or restarts) the transport, honouring the start delay. */
  start: () => void
  /** Pauses a running transport; a no-op while idle. */
  pause: () => void
  /** Play → pause → resume, for the single transport button. */
  toggle: () => void
  /** Stops the transport and rewinds the progress readout. */
  reset: () => void
  /** `ScrollView onScroll`: follows the reader's finger. */
  onScroll: (offsetY: number) => void
}

interface UseAutoscrollOptions {
  /** The `ScrollView` currently on screen (reader or stage mode). */
  scrollRef: React.RefObject<ScrollView | null>
  /** Speed in lyric lines per minute. */
  speed: number
  /** Countdown before the first move, in seconds. */
  delay: number
  /** Reader font size, used to convert the speed into pixels. */
  fontSize: number
  /** Reader preference: advance line by line instead of a continuous glide. */
  reducedMotion: boolean
  /** Measured content and viewport height of the reader. */
  contentHeight: number
  viewportHeight: number
}

/**
 * Drives the reader's autoscroll (roadmap #1).
 *
 * The transport is opt-in per session — it never starts on its own — while the
 * screen remembers the speed and the start delay per song and per user. A touch
 * or a drag pauses it; the small button resumes from the line the reader left
 * behind, because a manual scroll keeps the position in step. With
 * `reduceMotion` the lyrics advance one line at a time instead of gliding, so
 * the movement stays discrete.
 */
export const useAutoscroll = ({
  scrollRef,
  speed,
  delay,
  fontSize,
  reducedMotion,
  contentHeight,
  viewportHeight,
}: UseAutoscrollOptions): AutoscrollController => {
  const [status, setStatus] = useState<AutoscrollStatus>("idle")
  const [countdown, setCountdown] = useState(0)
  const [progress, setProgress] = useState(0)

  /** Where the lyrics currently are, and how far they can go. */
  const offsetRef = useRef(0)
  const metricsRef = useRef({ content: contentHeight, viewport: viewportHeight })
  /** Latest status, readable from the scroll callback without re-creating it. */
  const statusRef = useRef<AutoscrollStatus>("idle")
  /** What a pause should return to (pausing during the countdown restarts it). */
  const resumeToRef = useRef<AutoscrollStatus>("playing")
  const lastFrameRef = useRef(0)

  const limit = maxScrollOffset(contentHeight, viewportHeight)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    metricsRef.current = { content: contentHeight, viewport: viewportHeight }
  }, [limit, contentHeight, viewportHeight])

  const onScroll = useCallback((offsetY: number): void => {
    // While gliding we ignore the echoes of our own `scrollTo` calls; a manual
    // drag arrives while the transport is paused or idle, and then we follow it.
    if (statusRef.current === "playing") return
    offsetRef.current = offsetY
    const { content, viewport } = metricsRef.current
    setProgress(Math.round(scrollProgress(offsetY, content, viewport) * 100) / 100)
  }, [])

  // The driver: one animation frame per tick (or a discrete step when the
  // reader prefers reduced motion). Re-running it whenever the speed, the range
  // or the font size changes keeps the rate honest without extra bookkeeping.
  useEffect(() => {
    if (status !== "playing" || limit <= 0) return undefined
    const rate = autoscrollPixelsPerSecond(speed, fontSize)
    if (rate <= 0) return undefined

    let frame = 0
    let timer: ReturnType<typeof setInterval> | null = null

    const advance = (distance: number, animated: boolean): boolean => {
      const next = Math.min(limit, offsetRef.current + distance)
      offsetRef.current = next
      scrollRef.current?.scrollTo({ y: next, animated })
      setProgress(Math.round(Math.min(1, next / limit) * 100) / 100)
      if (next >= limit) {
        setStatus("done")
        return false
      }
      return true
    }

    if (reducedMotion) {
      const row = lyricRowHeight(fontSize)
      timer = setInterval(() => {
        advance(row, true)
      }, Math.max(250, (row / rate) * 1000))
    } else {
      lastFrameRef.current = Date.now()
      const tick = (): void => {
        const now = Date.now()
        const distance = (rate * (now - lastFrameRef.current)) / 1000
        lastFrameRef.current = now
        if (advance(distance, false)) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }

    return () => {
      if (frame) cancelAnimationFrame(frame)
      if (timer) clearInterval(timer)
    }
  }, [status, speed, fontSize, reducedMotion, limit, scrollRef])

  // Start delay: a visible countdown, then the transport takes over. The first
  // value is set by `start`/`toggle` (event handlers); this effect only ticks it
  // down, so it never calls setState synchronously while rendering commits.
  useEffect(() => {
    if (status !== "waiting") return undefined
    const startedAt = Date.now()
    const total = Math.max(0, Math.round(delay))
    const timer = setInterval(() => {
      const left = Math.max(0, total - Math.floor((Date.now() - startedAt) / 1000))
      setCountdown(left)
      if (left <= 0) setStatus("playing")
    }, 250)
    return () => clearInterval(timer)
  }, [status, delay])

  const start = useCallback((): void => {
    if (limit <= 0) return
    resumeToRef.current = "playing"
    const seconds = Math.max(0, Math.round(delay))
    if (seconds > 0 && offsetRef.current <= 0) {
      setCountdown(seconds)
      setStatus("waiting")
      return
    }
    setStatus("playing")
  }, [delay, limit])

  const pause = useCallback((): void => {
    const current = statusRef.current
    if (current !== "playing" && current !== "waiting") return
    resumeToRef.current = current
    setStatus("paused")
  }, [])

  const toggle = useCallback((): void => {
    const current = statusRef.current
    if (current === "playing" || current === "waiting") {
      pause()
      return
    }
    if (current === "paused") {
      // Resuming a paused countdown restarts it, so show its full value again.
      if (resumeToRef.current === "waiting") setCountdown(Math.max(0, Math.round(delay)))
      setStatus(resumeToRef.current)
      return
    }
    start()
  }, [delay, pause, start])

  const reset = useCallback((): void => {
    offsetRef.current = 0
    setProgress(0)
    setCountdown(0)
    setStatus("idle")
  }, [])

  const rate = autoscrollPixelsPerSecond(speed, fontSize)
  const remainingSeconds =
    limit > 0 && rate > 0 ? (Math.max(0, 1 - progress) * limit) / rate : null

  return {
    status,
    countdown,
    progress,
    remainingSeconds,
    canScroll: limit > 0,
    start,
    pause,
    toggle,
    reset,
    onScroll,
  }
}

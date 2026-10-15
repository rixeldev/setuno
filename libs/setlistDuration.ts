import { formatDurationLong } from "@/libs/format"

/** Largest target a setlist can claim: eight hours is beyond any set. */
export const MAX_GOAL_MINUTES = 480

/** Largest break worth counting separately: four hours is a wedding's whole gap. */
export const MAX_BREAK_MINUTES = 240

export interface DurationGoal {
  targetMinutes: number
  breakMinutes: number
  /** Songs plus the break — what the slot actually has to hold. */
  totalSec: number
  /** Positive: still to fill. Negative: running over. Zero: exactly there. */
  remainingSec: number
  over: boolean
  onTarget: boolean
}

/**
 * Reads a minutes field the way the form types it: empty, non-numeric or
 * negative means "no goal" (0), anything past `max` is pulled back to `max`.
 * Never NaN, never negative — the field is free text and this is the only
 * thing the service will ever see.
 */
export const parseGoalMinutes = (raw: string, max: number): number => {
  const value = Number.parseInt(raw.replace(/[^\d]/g, ""), 10)
  if (Number.isNaN(value)) return 0
  return Math.min(value, max)
}

/** The same bounds applied to a number already out of storage. */
export const clampGoalMinutes = (value: number, max: number): number => {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(Math.round(value), max)
}

interface SetlistGoalArgs {
  targetMinutes: number
  breakMinutes: number
  estimatedDurationSec: number
}

/**
 * The band's goal for a list (roadmap #42): the **slot** is the target, the
 * break eats into it, and what is left is what the songs still have to fill.
 * So `target = 45, break = 10` means 35 minutes of music fit — not 45 — and
 * the readout says so through `durationGoalText`.
 *
 * Returns `null` when there is no target: a list with no goal has nothing to
 * measure against, and every caller must then render nothing rather than
 * "0m left".
 */
export const setlistGoal = ({
  targetMinutes,
  breakMinutes,
  estimatedDurationSec,
}: SetlistGoalArgs): DurationGoal | null => {
  const target = clampGoalMinutes(targetMinutes, MAX_GOAL_MINUTES)
  if (target <= 0) return null

  const breakMinutesSafe = clampGoalMinutes(breakMinutes, MAX_BREAK_MINUTES)
  const targetSec = target * 60
  const totalSec = Math.max(0, Math.round(estimatedDurationSec)) + breakMinutesSafe * 60
  const remainingSec = targetSec - totalSec

  return {
    targetMinutes: target,
    breakMinutes: breakMinutesSafe,
    totalSec,
    remainingSec,
    over: remainingSec < 0,
    onTarget: remainingSec === 0,
  }
}

type Translate = (key: string, options?: Record<string, unknown>) => string

/**
 * "39m left" / "6m over the goal" / "On target" — the one number the band
 * looks at. The absolute time is formatted, never the signed value:
 * `formatDurationLong` maps anything `<= 0` to "--", so a 30-second overrun
 * would otherwise print as an em dash instead of "1m over".
 */
export const durationGoalText = (goal: DurationGoal, t: Translate): string => {
  if (goal.onTarget) return t("setlists.goalOnTarget")
  const time = formatDurationLong(Math.abs(goal.remainingSec))
  return goal.over ? t("setlists.goalOver", { time }) : t("setlists.goalRemaining", { time })
}

/** "Goal 45m" or "Goal 45m · 10m break" — the target line above the status. */
export const durationGoalTargetLabel = (goal: DurationGoal, t: Translate): string =>
  goal.breakMinutes > 0 ?
    t("setlists.goalTargetBreak", {
      target: formatDurationLong(goal.targetMinutes * 60),
      breakTime: formatDurationLong(goal.breakMinutes * 60),
    })
  : t("setlists.goalTarget", { target: formatDurationLong(goal.targetMinutes * 60) })

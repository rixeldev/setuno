import { describe, expect, it } from "vitest"

import {
  clampGoalMinutes,
  durationGoalTargetLabel,
  durationGoalText,
  MAX_BREAK_MINUTES,
  MAX_GOAL_MINUTES,
  parseGoalMinutes,
  setlistGoal,
} from "@/libs/setlistDuration"

const TEMPLATES: Record<string, string> = {
  "setlists.goalOnTarget": "On target",
  "setlists.goalOver": "{{time}} over the goal",
  "setlists.goalRemaining": "{{time}} left",
  "setlists.goalTarget": "Goal {{target}}",
  "setlists.goalTargetBreak": "Goal {{target}} · {{breakTime}} break",
}

/** `t` stub: resolves a fake template and interpolates `{{name}}`. */
const t = (key: string, options?: Record<string, unknown>): string => {
  const template = TEMPLATES[key] ?? key
  if (!options) return template
  return Object.entries(options).reduce(
    (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
    template,
  )
}

const goal = (overrides: Partial<Parameters<typeof setlistGoal>[0]> = {}) =>
  setlistGoal({
    targetMinutes: 45,
    breakMinutes: 0,
    estimatedDurationSec: 0,
    ...overrides,
  })

describe("setlistGoal", () => {
  it("has no goal until a target is set", () => {
    expect(goal({ targetMinutes: 0 })).toBeNull()
    expect(goal({ targetMinutes: -45 })).toBeNull()
    expect(goal({ targetMinutes: Number.NaN })).toBeNull()
    expect(goal({ targetMinutes: Number.POSITIVE_INFINITY })).toBeNull()
  })

  it("measures the songs against the target", () => {
    const result = goal({ estimatedDurationSec: 40 * 60 })
    expect(result).toMatchObject({
      targetMinutes: 45,
      breakMinutes: 0,
      totalSec: 40 * 60,
      remainingSec: 5 * 60,
      over: false,
      onTarget: false,
    })
  })

  it("counts the break against the target, so the songs get what is left", () => {
    // The spec's "include breaks": a 45-minute slot with a 10-minute break
    // holds 35 minutes of music, not 45.
    const result = goal({ targetMinutes: 45, breakMinutes: 10, estimatedDurationSec: 40 * 60 })
    expect(result).toMatchObject({ totalSec: 50 * 60, remainingSec: -5 * 60, over: true })
  })

  it("knows the difference between left, over and exactly there", () => {
    expect(goal({ estimatedDurationSec: 44 * 60 })?.over).toBe(false)
    expect(goal({ estimatedDurationSec: 46 * 60 })?.over).toBe(true)
    expect(goal({ estimatedDurationSec: 45 * 60 })?.onTarget).toBe(true)
  })

  it("pulls an absurd target or break back to the bounds", () => {
    const result = goal({ targetMinutes: 10_000, breakMinutes: 999 })
    expect(result).toMatchObject({ targetMinutes: MAX_GOAL_MINUTES, breakMinutes: MAX_BREAK_MINUTES })
  })
})

describe("durationGoalText", () => {
  it("says how much is left while under", () => {
    const result = goal({ estimatedDurationSec: 40 * 60 })!
    expect(durationGoalText(result, t)).toBe("5m left")
  })

  it("says how far over it is while above", () => {
    const result = goal({ estimatedDurationSec: 51 * 60 })!
    expect(durationGoalText(result, t)).toBe("6m over the goal")
  })

  it("has its own words for landing exactly on the target", () => {
    const result = goal({ estimatedDurationSec: 45 * 60 })!
    expect(durationGoalText(result, t)).toBe("On target")
  })

  it("reports a sliver over as a minute, never as an em dash", () => {
    // `formatDurationLong` maps anything <= 0 to "--", so the sign has to be
    // taken off first or a 30-second overrun would print as "-- over the goal".
    const result = goal({ estimatedDurationSec: 45 * 60 + 30 })!
    expect(durationGoalText(result, t)).toBe("1m over the goal")
  })

  it("names the break only when there is one", () => {
    expect(durationGoalTargetLabel(goal({ targetMinutes: 45 })!, t)).toBe("Goal 45m")
    expect(
      durationGoalTargetLabel(goal({ targetMinutes: 45, breakMinutes: 10 })!, t),
    ).toBe("Goal 45m · 10m break")
  })
})

describe("goal minutes from a text field", () => {
  it("reads what the user typed, digits only", () => {
    expect(parseGoalMinutes("", MAX_GOAL_MINUTES)).toBe(0)
    expect(parseGoalMinutes("   ", MAX_GOAL_MINUTES)).toBe(0)
    expect(parseGoalMinutes("forty", MAX_GOAL_MINUTES)).toBe(0)
    expect(parseGoalMinutes("45", MAX_GOAL_MINUTES)).toBe(45)
    // Whatever a user types around the number, only the digits survive.
    expect(parseGoalMinutes("45 min", MAX_GOAL_MINUTES)).toBe(45)
    expect(parseGoalMinutes("10", MAX_BREAK_MINUTES)).toBe(10)
  })

  it("clamps a number already out of storage", () => {
    expect(clampGoalMinutes(45.4, MAX_GOAL_MINUTES)).toBe(45)
    expect(clampGoalMinutes(45.6, MAX_GOAL_MINUTES)).toBe(46)
    expect(clampGoalMinutes(0, MAX_GOAL_MINUTES)).toBe(0)
    expect(clampGoalMinutes(-1, MAX_GOAL_MINUTES)).toBe(0)
    expect(clampGoalMinutes(Number.NaN, MAX_GOAL_MINUTES)).toBe(0)
    expect(clampGoalMinutes(9999, MAX_GOAL_MINUTES)).toBe(MAX_GOAL_MINUTES)
  })
})

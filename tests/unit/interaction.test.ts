import { describe, expect, it } from "vitest"

import { webInteractionState } from "@/libs/interaction"

describe("webInteractionState", () => {
  it("reads only `pressed`, the state every platform reports", () => {
    expect(webInteractionState({ pressed: true })).toEqual({
      pressed: true,
      hovered: false,
      focused: false,
    })
  })

  it("keeps hovered and focused when the web renderer carries them", () => {
    expect(webInteractionState({ pressed: false, hovered: true, focused: true })).toEqual({
      pressed: false,
      hovered: true,
      focused: true,
    })
  })

  it("only trusts literal booleans", () => {
    // A renderer that sends a truthy non-boolean must not light up the ring.
    expect(webInteractionState({ pressed: 1, hovered: "yes", focused: null })).toEqual({
      pressed: false,
      hovered: false,
      focused: false,
    })
  })

  it("survives a missing state object", () => {
    expect(webInteractionState(undefined)).toEqual({
      pressed: false,
      hovered: false,
      focused: false,
    })
  })
})

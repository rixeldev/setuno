import { describe, expect, it } from "vitest"

import { COMMENT_MAX_LENGTH, sanitizeCommentBody } from "@/libs/suggestionComments"

describe("sanitizeCommentBody", () => {
  it("keeps a plain comment as it was written", () => {
    expect(sanitizeCommentBody("Totally agree with the G version")).toBe(
      "Totally agree with the G version",
    )
  })

  it("trims outer whitespace only", () => {
    expect(sanitizeCommentBody("  love this  ")).toBe("love this")
  })

  it("treats a whitespace-only comment as nothing to say", () => {
    expect(sanitizeCommentBody("")).toBeNull()
    expect(sanitizeCommentBody("   \n\t  ")).toBeNull()
    expect(sanitizeCommentBody("\r\n")).toBeNull()
  })

  it("normalises CRLF and lone-CR line endings", () => {
    expect(sanitizeCommentBody("line one\r\nline two")).toBe("line one\nline two")
    expect(sanitizeCommentBody("line one\rline two")).toBe("line one\nline two")
  })

  it("keeps interior spacing and blank lines — this is a discussion", () => {
    const body = "first point\n\n  second point, indented"
    expect(sanitizeCommentBody(body)).toBe(body)
  })

  it("clamps a runaway paste to the rules' own limit", () => {
    const result = sanitizeCommentBody("a".repeat(COMMENT_MAX_LENGTH + 400))
    expect(result).not.toBeNull()
    expect(result?.length).toBe(COMMENT_MAX_LENGTH)
  })

  it("never ends the cut inside an emoji", () => {
    // 999 letters + an astral pair: the slice lands on the lone high
    // surrogate, which must not survive into the stored document.
    const result = sanitizeCommentBody(`${"a".repeat(COMMENT_MAX_LENGTH - 1)}😀`)
    expect(result).toBe("a".repeat(COMMENT_MAX_LENGTH - 1))
  })

  it("leaves a comment exactly at the limit alone", () => {
    const body = "ñ".repeat(COMMENT_MAX_LENGTH)
    expect(sanitizeCommentBody(body)).toBe(body)
  })

  it("keeps accents and other multi-byte characters whole", () => {
    expect(sanitizeCommentBody("¿Qué versión tocamos mañana?")).toBe(
      "¿Qué versión tocamos mañana?",
    )
  })
})

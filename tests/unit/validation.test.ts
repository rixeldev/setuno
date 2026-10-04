import { describe, expect, it } from "vitest"

import {
  ensure,
  isValidEmail,
  parseIsoDate,
  parseOptionalPositiveInt,
  parseTags,
  toIsoDate,
  validateBpm,
  validateCapo,
  validateDuration,
  validateEmail,
  validateOptionalText,
  validatePassword,
  validateRequired,
  validateTags,
  validateTime,
} from "@/libs/validation"
import { ValidationError } from "@/services/errors"

describe("email", () => {
  it("accepts real addresses and trims them", () => {
    expect(isValidEmail("drummer@example.com")).toBe(true)
    expect(isValidEmail("  a.b+tag@band.co.uk ")).toBe(true)
  })

  it("rejects incomplete addresses", () => {
    expect(isValidEmail("")).toBe(false)
    expect(isValidEmail("drummer")).toBe(false)
    expect(isValidEmail("drummer@example")).toBe(false)
    expect(isValidEmail("a b@example.com")).toBe(false)
  })

  it("explains what is wrong", () => {
    expect(validateEmail("")).toBe("Email is required.")
    expect(validateEmail("nope")).toBe("Enter a valid email address.")
    expect(validateEmail("drummer@example.com")).toBeNull()
    expect(validateEmail("nope", "Sign-in email")).toBe("Enter a valid email address.")
  })
})

describe("password", () => {
  it("requires a value of a sensible length", () => {
    expect(validatePassword("")).toBe("Password is required.")
    expect(validatePassword("abc")).toBe("Password must be at least 6 characters.")
    expect(validatePassword("a".repeat(129))).toBe("Password must be shorter than 128 characters.")
    expect(validatePassword("secret1")).toBeNull()
  })
})

describe("required and optional text", () => {
  it("treats whitespace as empty", () => {
    expect(validateRequired("   ", "Band name")).toBe("Band name is required.")
    expect(validateRequired("The Band", "Band name")).toBeNull()
  })

  it("enforces a maximum length", () => {
    expect(validateRequired("abcd", "Name", { max: 3 })).toBe("Name must be 3 characters or fewer.")
    expect(validateOptionalText("   ", "Notes")).toBeNull()
    expect(validateOptionalText("abcd", "Notes", { max: 3 })).toBe("Notes must be 3 characters or fewer.")
  })
})

describe("numbers", () => {
  it("parses optional positive integers", () => {
    expect(parseOptionalPositiveInt("")).toBeNull()
    expect(parseOptionalPositiveInt("120")).toBe(120)
    expect(parseOptionalPositiveInt("0")).toBe(0)
    expect(parseOptionalPositiveInt("-5")).toBeNull()
    expect(parseOptionalPositiveInt("abc")).toBeNull()
  })

  it("keeps tempo inside a playable range", () => {
    expect(validateBpm("")).toBeNull()
    expect(validateBpm("120")).toBeNull()
    expect(validateBpm("fast")).toBe("Enter a valid tempo.")
    expect(validateBpm("19")).toBe("Tempo must be between 20 and 400 BPM.")
    expect(validateBpm("401")).toBe("Tempo must be between 20 and 400 BPM.")
  })

  it("only allows whole capo frets up to 12", () => {
    expect(validateCapo("")).toBeNull()
    expect(validateCapo("0")).toBeNull()
    expect(validateCapo("12")).toBeNull()
    expect(validateCapo("2.5")).toBe("Capo must be a whole fret number.")
    expect(validateCapo("13")).toBe("Capo must be between 0 and 12.")
    expect(validateCapo("-1")).toBe("Capo must be between 0 and 12.")
  })

  it("expects durations as mm:ss", () => {
    expect(validateDuration("")).toBeNull()
    expect(validateDuration("3:45")).toBeNull()
    expect(validateDuration("3:45:00")).toBe("Use mm:ss, for example 3:45.")
    expect(validateDuration("3:75")).toBe("Seconds must be 00-59.")
  })
})

describe("dates and times", () => {
  it("round-trips ISO dates", () => {
    const date = new Date(2026, 9, 2)
    expect(toIsoDate(date)).toBe("2026-10-02")
    const parsed = parseIsoDate("2026-10-02")
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(9)
    expect(parsed?.getDate()).toBe(2)
  })

  it("rejects anything that is not yyyy-mm-dd", () => {
    expect(parseIsoDate("02/10/2026")).toBeNull()
    expect(parseIsoDate("")).toBeNull()
    expect(parseIsoDate("2026-10")).toBeNull()
  })

  it("expects 24h times", () => {
    expect(validateTime("", "Start time")).toBeNull()
    expect(validateTime("21:00", "Start time")).toBeNull()
    expect(validateTime("00:00", "Start time")).toBeNull()
    expect(validateTime("24:00", "Start time")).toBe("Enter start time as HH:mm (24h).")
    expect(validateTime("9pm", "Start time")).toBe("Enter start time as HH:mm (24h).")
  })
})

describe("tags", () => {
  it("lowercases, trims, de-duplicates and caps the list", () => {
    expect(parseTags(" Rock , POP ,, soul ")).toEqual(["rock", "pop", "soul"])
    expect(parseTags("")).toEqual([])
    const many = Array.from({ length: 20 }, (_, index) => `tag${index}`).join(",")
    expect(parseTags(many)).toHaveLength(12)
  })

  it("drops tags that are too long to be useful", () => {
    expect(parseTags("ok,this-tag-is-far-too-long-to-be-useful")).toEqual(["ok"])
    expect(parseTags("a".repeat(25))).toEqual([])
    expect(parseTags("a".repeat(24))).toEqual(["a".repeat(24)])
  })

  it("never reports more than twelve tags", () => {
    const many = Array.from({ length: 20 }, (_, index) => `tag${index}`).join(",")
    expect(validateTags(many)).toBeNull()
    expect(validateTags("rock")).toBeNull()
  })
})

describe("ensure", () => {
  it("passes when there is no message", () => {
    expect(() => ensure(null)).not.toThrow()
  })

  it("throws a ValidationError carrying the field", () => {
    expect(() => ensure("Give the song a title.", "title")).toThrow(ValidationError)
    try {
      ensure("Give the song a title.", "title")
    } catch (error) {
      expect((error as ValidationError).field).toBe("title")
      expect((error as ValidationError).message).toBe("Give the song a title.")
    }
  })
})
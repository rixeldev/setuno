import { describe, expect, it } from "vitest"

import {
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  isLanguageCode,
  isLanguagePreference,
  matchLanguage,
  resolveLanguage,
} from "@/libs/language"

describe("language preferences", () => {
  it("ships a native name for every supported language", () => {
    expect(SUPPORTED_LANGUAGES).toEqual(["en", "es"])
    for (const code of SUPPORTED_LANGUAGES) {
      expect(LANGUAGE_NAMES[code]).toBeTruthy()
    }
  })

  it("matches the base language of a device tag", () => {
    expect(matchLanguage("es-MX")).toBe("es")
    expect(matchLanguage("es")).toBe("es")
    expect(matchLanguage("en-GB")).toBe("en")
  })

  it("falls back to English for unsupported or missing tags", () => {
    expect(matchLanguage("fr-CA")).toBe("en")
    expect(matchLanguage("")).toBe("en")
    expect(matchLanguage(null)).toBe("en")
    expect(matchLanguage(undefined)).toBe("en")
  })

  it("resolves an explicit choice over the device language", () => {
    expect(resolveLanguage("es", "en-US")).toBe("es")
    expect(resolveLanguage("device", "es-AR")).toBe("es")
    expect(resolveLanguage("device", "de-DE")).toBe("en")
  })

  it("accepts only values the app can store", () => {
    expect(isLanguagePreference("device")).toBe(true)
    expect(isLanguagePreference("es")).toBe(true)
    expect(isLanguagePreference("de")).toBe(false)
    expect(isLanguagePreference(42)).toBe(false)
    expect(isLanguageCode("es")).toBe(true)
    expect(isLanguageCode("ES")).toBe(false)
  })
})

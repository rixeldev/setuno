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
    expect(SUPPORTED_LANGUAGES).toEqual(["en", "es", "pt-BR", "fr"])
    for (const code of SUPPORTED_LANGUAGES) {
      expect(LANGUAGE_NAMES[code]).toBeTruthy()
    }
  })

  it("matches the base language of a device tag", () => {
    expect(matchLanguage("es-MX")).toBe("es")
    expect(matchLanguage("es")).toBe("es")
    expect(matchLanguage("en-GB")).toBe("en")
    expect(matchLanguage("fr-CA")).toBe("fr")
    expect(matchLanguage("fr")).toBe("fr")
  })

  it("keeps the region when we ship it", () => {
    expect(matchLanguage("pt-BR")).toBe("pt-BR")
    expect(matchLanguage("pt-br")).toBe("pt-BR")
    expect(matchLanguage("pt_BR")).toBe("pt-BR")
  })

  it("sends every Portuguese device to the only Portuguese we ship", () => {
    expect(matchLanguage("pt")).toBe("pt-BR")
    expect(matchLanguage("pt-PT")).toBe("pt-BR")
  })

  it("falls back to English for unsupported or missing tags", () => {
    expect(matchLanguage("de-DE")).toBe("en")
    expect(matchLanguage("it")).toBe("en")
    expect(matchLanguage("")).toBe("en")
    expect(matchLanguage(null)).toBe("en")
    expect(matchLanguage(undefined)).toBe("en")
  })

  it("resolves an explicit choice over the device language", () => {
    expect(resolveLanguage("es", "en-US")).toBe("es")
    expect(resolveLanguage("device", "es-AR")).toBe("es")
    expect(resolveLanguage("device", "pt-BR")).toBe("pt-BR")
    expect(resolveLanguage("device", "de-DE")).toBe("en")
  })

  it("accepts only values the app can store", () => {
    expect(isLanguagePreference("device")).toBe(true)
    expect(isLanguagePreference("es")).toBe(true)
    expect(isLanguagePreference("pt-BR")).toBe(true)
    expect(isLanguagePreference("fr")).toBe(true)
    expect(isLanguagePreference("de")).toBe(false)
    expect(isLanguagePreference(42)).toBe(false)
    expect(isLanguageCode("es")).toBe(true)
    expect(isLanguageCode("pt-BR")).toBe(true)
    expect(isLanguageCode("ES")).toBe(false)
  })
})

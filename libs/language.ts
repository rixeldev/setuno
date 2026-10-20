/**
 * Supported UI languages and how a device language tag maps onto them.
 *
 * Four languages ship (roadmap #70): English, Spanish, Brazilian Portuguese and
 * French. `pt-BR` is deliberately the *regional* code and not a plain `pt`:
 * Brazilian Portuguese is what the translation was written for, and a device
 * set to European Portuguese still reads it far better than English.
 */

export const SUPPORTED_LANGUAGES = ["en", "es", "pt-BR", "fr"] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]

/** "device" means "always follow the language the phone/browser is set to". */
export type LanguagePreference = "device" | LanguageCode

/** Native names of each language (never translated: they are the option labels). */
export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: "English",
  es: "Español",
  "pt-BR": "Português (Brasil)",
  fr: "Français",
}

export const isLanguageCode = (value: unknown): value is LanguageCode =>
  typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)

export const isLanguagePreference = (value: unknown): value is LanguagePreference =>
  value === "device" || isLanguageCode(value)

/** "pt_BR" / "pt-br" -> "pt-br"; the comparison is case- and separator-agnostic. */
const normalizeTag = (tag: string | null | undefined): string =>
  (tag ?? "").replace(/_/g, "-").trim().toLowerCase()

/**
 * "es-MX" -> "es" when supported, otherwise the English fallback.
 *
 * An exact tag wins first ("pt-BR" -> "pt-BR"), then the base language
 * ("pt-PT" and "pt" both land on the only Portuguese we ship, "pt-BR"; "fr-CA"
 * lands on "fr"). A tag nobody serves falls back to English rather than to a
 * sibling language the member did not ask for.
 */
export const matchLanguage = (tag: string | null | undefined): LanguageCode => {
  const normalized = normalizeTag(tag)
  if (normalized.length === 0) return "en"

  const exact = SUPPORTED_LANGUAGES.find((code) => code.toLowerCase() === normalized)
  if (exact) return exact

  const base = normalized.split("-")[0] ?? ""
  const byBase = SUPPORTED_LANGUAGES.find((code) => code.toLowerCase().split("-")[0] === base)
  return byBase ?? "en"
}

/** Turns a stored preference + the device tag into a language we ship. */
export const resolveLanguage = (
  preference: LanguagePreference,
  deviceTag: string | null | undefined,
): LanguageCode => (preference === "device" ? matchLanguage(deviceTag) : preference)

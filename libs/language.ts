/** Supported UI languages and how a device language tag maps onto them. */

export const SUPPORTED_LANGUAGES = ["en", "es"] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]

/** "device" means "always follow the language the phone/browser is set to". */
export type LanguagePreference = "device" | LanguageCode

/** Native names of each language (never translated: they are the option labels). */
export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: "English",
  es: "Español",
}

export const isLanguageCode = (value: unknown): value is LanguageCode =>
  typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)

export const isLanguagePreference = (value: unknown): value is LanguagePreference =>
  value === "device" || isLanguageCode(value)

/** "es-MX" -> "es" when supported, otherwise the English fallback. */
export const matchLanguage = (tag: string | null | undefined): LanguageCode => {
  const base = (tag ?? "").split(/[-_]/)[0]?.toLowerCase() ?? ""
  return isLanguageCode(base) ? base : "en"
}

/** Turns a stored preference + the device tag into a language we ship. */
export const resolveLanguage = (
  preference: LanguagePreference,
  deviceTag: string | null | undefined,
): LanguageCode => (preference === "device" ? matchLanguage(deviceTag) : preference)

import { getLocales } from "react-native-localize"

/** ISO language tag of the device, e.g. "es-ES" (native platforms only). */
export const getDeviceLanguage = (): string => {
  try {
    return getLocales()[0]?.languageTag ?? "en"
  } catch {
    // Never let a platform hiccup decide the UI language.
    return "en"
  }
}

import { useSyncExternalStore } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "@/locales/en.json"
import es from "@/locales/es.json"
import { getDeviceLanguage } from "@/libs/deviceLanguage"
import {
  isLanguagePreference,
  matchLanguage,
  resolveLanguage,
  type LanguageCode,
  type LanguagePreference,
} from "@/libs/language"

const resources = {
  en: { translation: en },
  es: { translation: es },
}

/** Survives restarts: "device" (default) or an explicit language. */
const STORAGE_KEY = "stage-book:language:v1"

i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources,
  interpolation: {
    escapeValue: false,
  },
})

let preference: LanguagePreference = "device"
const listeners = new Set<() => void>()

const notify = (): void => {
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The stored choice; "device" follows the phone/browser language. */
export const getLanguagePreference = (): LanguagePreference => preference

/** The language actually rendered right now. */
export const getLanguage = (): LanguageCode => matchLanguage(i18n.language)

export const useLanguagePreference = (): LanguagePreference =>
  useSyncExternalStore(subscribe, getLanguagePreference, getLanguagePreference)

/** Applies and persists a language choice (docs §32). */
export const setLanguagePreference = async (next: LanguagePreference): Promise<void> => {
  preference = next
  notify()
  try {
    await AsyncStorage.setItem(STORAGE_KEY, next)
  } catch {
    // A failed write only costs persistence, never the switch itself.
  }
  await i18n.changeLanguage(resolveLanguage(next, getDeviceLanguage()))
}

/**
 * Restores the stored choice at start-up and, when it is "device", follows the
 * device language. Called once before the first frame (docs §32).
 */
export const hydrateLanguage = async (): Promise<void> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    if (isLanguagePreference(stored)) preference = stored
  } catch {
    // Corrupted storage must never block start-up: fall back to the device.
  }
  await i18n.changeLanguage(resolveLanguage(preference, getDeviceLanguage()))
}

export default i18n

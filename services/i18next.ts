import en from "@/locales/en.json"
import es from "@/locales/es.json"
import i18n from "i18next"
import { initReactI18next } from "react-i18next"

const resources = {
  en: { translation: en },
  es: { translation: es },
}

i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: resources,
  interpolation: {
    escapeValue: false,
  },
})

export default i18n

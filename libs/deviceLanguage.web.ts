/** ISO language tag of the browser, e.g. "es-ES" (web only). */
export const getDeviceLanguage = (): string => {
  if (typeof navigator === "undefined") return "en"
  return navigator.language || navigator.languages?.[0] || "en"
}

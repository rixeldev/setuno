import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { useAuth } from "@/hooks/useAuth"
import { matchLanguage } from "@/libs/language"
import { refreshPushRegistration } from "@/services/notifications"

/**
 * Keeps this install's push registration alive (roadmap #52): one silent
 * refresh when the account (or its language) changes, so the device document
 * carries the right `lang` and `lastSeenAt`. It never prompts — the permission
 * question belongs to the settings screen alone — and it never re-creates a
 * registration: no permission, no cached token, or a document the user
 * deleted, and it does nothing at all. Failures are swallowed on purpose (an
 * offline start simply skips this round).
 */
export function usePushRegistration(): void {
  const { user } = useAuth()
  const { i18n } = useTranslation()
  const uid = user?.uid ?? null
  const lang = matchLanguage(i18n.language)

  useEffect(() => {
    if (!uid) return
    void refreshPushRegistration(uid, lang).catch(() => undefined)
  }, [uid, lang])
}

import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { useAuth } from "@/hooks/useAuth"
import { matchLanguage } from "@/libs/language"
import { shouldAskForPush } from "@/libs/pushPrompt"
import {
  enablePushForThisDevice,
  getPushPermissionState,
  hasAskedForPush,
  rememberPushPrompt,
} from "@/services/notifications"

/**
 * The app-start question about push notifications (roadmap #52).
 *
 * The app asks once, when the member enters the app, whether they want
 * notifications — a question the settings screen alone used to leave to them to
 * find. The rules live in `libs/pushPrompt.ts`: the question is only worth
 * asking while the OS would still ask (an undetermined permission), and only
 * once per install (the answer is remembered on the device, because the
 * permission lives in the OS and the registration in Firestore).
 *
 * Saying yes asks the OS and registers this install, which is exactly what
 * the settings switch does — so the switch there is already on when the
 * member opens it. Saying no changes nothing: no document is written, so the
 * silent refresh can never turn it back on, and the settings screen is where
 * the question can be answered again.
 */
export interface PushPromptApi {
  /** True while the question is on screen. */
  visible: boolean
  /** The member said yes: ask the OS and register this device. */
  accept: () => void
  /** The member said not now: never ask again on this install. */
  decline: () => void
}

export function usePushPrompt(): PushPromptApi {
  const { user } = useAuth()
  const { i18n } = useTranslation()
  const uid = user?.uid ?? null
  const lang = matchLanguage(i18n.language)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!uid) return
    let alive = true
    void (async () => {
      const [asked, permission] = await Promise.all([
        hasAskedForPush(),
        getPushPermissionState(),
      ])
      if (!alive) return
      if (shouldAskForPush(asked, permission)) {
        setVisible(true)
        return
      }
      // The permission is settled (granted or blocked): the question would
      // never be answered, so the install is marked as asked.
      if (permission !== "undetermined") await rememberPushPrompt()
    })().catch(() => undefined)
    return () => {
      alive = false
    }
  }, [uid])

  const accept = useCallback(() => {
    setVisible(false)
    void (async () => {
      await rememberPushPrompt()
      if (!uid) return
      try {
        // The same call the settings switch makes: ask the OS, then write this
        // install's device document. A failure (offline, no token) leaves the
        // permission granted and the settings screen able to finish the job.
        await enablePushForThisDevice(uid, lang)
      } catch {
        // Nothing to say here: the settings screen shows the state and can
        // ask again.
      }
    })()
  }, [uid, lang])

  const decline = useCallback(() => {
    setVisible(false)
    void rememberPushPrompt()
  }, [])

  return { visible, accept, decline }
}

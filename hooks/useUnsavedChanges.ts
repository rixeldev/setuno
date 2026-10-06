import { useCallback, useEffect, useState } from "react"
import { Platform } from "react-native"
import { useNavigation } from "expo-router"
// SDK 56+: React Navigation is consumed through Expo Router's own entry point.
import { usePreventRemove } from "expo-router/react-navigation"

type PreventRemoveHandler = Parameters<typeof usePreventRemove>[1]
type PendingAction = Parameters<PreventRemoveHandler>[0]["data"]["action"]

/**
 * Guards a screen with unsaved work.
 *
 * Every attempt to leave — the header back button, the Android back gesture,
 * a tab press or any other navigation — is intercepted and reported through
 * `confirmVisible`; the form shows a confirmation dialog and only continues
 * with `discardAndLeave`. On web it also warns before closing the tab.
 */
export const useUnsavedChanges = (hasUnsavedChanges: boolean) => {
  const navigation = useNavigation()
  const [pending, setPending] = useState<PendingAction | null>(null)
  // Once the user confirms, the guard is disabled for one render so the action
  // can be dispatched without being intercepted again (which would loop).
  const [leaving, setLeaving] = useState<PendingAction | null>(null)

  usePreventRemove(hasUnsavedChanges && leaving === null, ({ data }) => {
    setPending(data.action as PendingAction)
  })

  useEffect(() => {
    if (leaving) navigation.dispatch(leaving)
  }, [leaving, navigation])

  useEffect(() => {
    if (!hasUnsavedChanges || Platform.OS !== "web" || typeof window === "undefined") return
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      // Chrome needs `returnValue` set to show its native confirmation.
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [hasUnsavedChanges])

  const discardAndLeave = useCallback(() => {
    if (!pending) return
    setPending(null)
    setLeaving(pending)
  }, [pending])

  const keepEditing = useCallback(() => setPending(null), [])

  return { confirmVisible: pending !== null, discardAndLeave, keepEditing }
}

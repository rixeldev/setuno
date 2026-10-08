import React, { useEffect, useState } from "react"
import { Linking, Platform } from "react-native"
import { useNetInfo } from "@react-native-community/netinfo"
import { useTranslation } from "react-i18next"

import { Dialog } from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { APP_STORE_URL, PLAY_STORE_URL } from "@/libs/appLinks"
import { isRunningLatestVersion } from "@/services/version"

/**
 * Forces a store update when this build's `version` record no longer exists
 * in Firestore (see `services/version.ts`). It only applies to the native
 * apps — the web bundle always ships the latest code.
 *
 * On Wi-Fi the dialog cannot be dismissed; on mobile data updating is optional
 * so the user does not burn their data plan (docs §36).
 */
export function AppUpdateGate() {
  const { t } = useTranslation()
  const netInfo = useNetInfo()
  const [outdated, setOutdated] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (Platform.OS === "web") return
    let active = true
    void isRunningLatestVersion().then((latest) => {
      // `null` means "could not tell" (offline): keep the app usable.
      if (active && latest === false) setOutdated(true)
    })
    return () => {
      active = false
    }
  }, [])

  if (!outdated || dismissed) return null

  const onCellular = netInfo.type === "cellular"
  const openStore = (): void => {
    void Linking.openURL(Platform.OS === "ios" ? APP_STORE_URL : PLAY_STORE_URL).catch(
      () => undefined,
    )
  }

  return (
    <Dialog
      visible
      dismissible={onCellular}
      onClose={() => setDismissed(true)}
      title={t("update.title")}
      description={onCellular ? t("update.cellular") : t("update.description")}
      hideActions
    >
      <Button label={t("update.action")} onPress={openStore} />
      {onCellular ? (
        <Button label={t("update.later")} variant="ghost" onPress={() => setDismissed(true)} />
      ) : null}
    </Dialog>
  )
}

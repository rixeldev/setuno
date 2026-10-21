import React from "react"
import { useTranslation } from "react-i18next"

import { Dialog } from "@/components/ui/Dialog"

/**
 * The app-start question about push notifications (roadmap #52).
 *
 * It is a plain dialog with two answers: yes asks the OS and registers this
 * install (so the settings switch is already on), no changes nothing and is
 * never asked again on this install. It cannot be dismissed by tapping outside
 * — the member answers it or answers it later in the settings screen.
 */
export function PushPromptDialog({
  visible,
  onAccept,
  onDecline,
}: {
  visible: boolean
  onAccept: () => void
  onDecline: () => void
}) {
  const { t } = useTranslation()

  return (
    <Dialog
      visible={visible}
      onClose={onDecline}
      title={t("push.askTitle")}
      description={t("push.askBody")}
      confirmLabel={t("push.askAccept")}
      cancelLabel={t("push.askLater")}
      onConfirm={onAccept}
      dismissible={false}
    />
  )
}

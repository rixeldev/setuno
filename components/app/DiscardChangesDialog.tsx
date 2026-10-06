import React from "react"
import { useTranslation } from "react-i18next"

import { Dialog } from "@/components/ui/Dialog"

interface DiscardChangesDialogProps {
  visible: boolean
  /** What is about to be lost, already translated, e.g. “changes to this song”. */
  what?: string
  onKeepEditing: () => void
  onDiscard: () => void
}

/**
 * Confirmation shown when leaving a form with unsaved changes, so a stray back
 * gesture or tab tap can never throw the user's work away.
 */
export function DiscardChangesDialog({
  visible,
  what,
  onKeepEditing,
  onDiscard,
}: DiscardChangesDialogProps) {
  const { t } = useTranslation()
  const description = t("common.unsavedChanges", { what: what ?? t("common.changes") })

  return (
    <Dialog
      visible={visible}
      onClose={onKeepEditing}
      title={t("common.discardChangesTitle")}
      description={description}
      confirmLabel={t("common.discard")}
      cancelLabel={t("common.keepEditing")}
      tone="danger"
      onConfirm={onDiscard}
    />
  )
}

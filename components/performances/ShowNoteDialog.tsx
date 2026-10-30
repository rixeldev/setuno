import React from "react"
import { StyleSheet } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { sanitizeShowNoteBody } from "@/libs/showNotes"

interface ShowNoteDialogProps {
  visible: boolean
  /** Song on screen — shown as context and stamped on the note by the caller. */
  songTitle: string
  value: string
  onChangeText: (value: string) => void
  onClose: () => void
  onSave: () => void
  saving?: boolean
}

/**
 * The one night-note composer (roadmap #90), shared by the live strip (a note
 * written mid-show, stamped with the song on screen) and the post-gig report
 * (a note about the night). The caller owns the draft and the write, exactly
 * like the report's per-song note dialog.
 */
export function ShowNoteDialog({
  visible,
  songTitle,
  value,
  onChangeText,
  onClose,
  onSave,
  saving = false,
}: ShowNoteDialogProps) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={t("performances.showNoteTitle")}
      description={t("performances.showNoteDescription")}
      confirmLabel={t("common.save")}
      confirmDisabled={saving || sanitizeShowNoteBody(value) === null}
      confirmLoading={saving}
      onConfirm={onSave}
    >
      {songTitle ? (
        <AppText variant="caption" tone="muted" style={styles.for}>
          {t("performances.showNoteFor", { title: songTitle })}
        </AppText>
      ) : null}
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={t("performances.showNotePlaceholder")}
        multiline
        autoFocus
      />
    </Dialog>
  )
}

const createStyles = () =>
  StyleSheet.create({
    for: { marginBottom: Theme.spacing.xs },
  })

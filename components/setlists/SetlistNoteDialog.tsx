import React from "react"
import { useTranslation } from "react-i18next"

import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { MAX_SONG_NOTE } from "@/libs/setlistBlocks"

export interface SetlistNoteDialogProps {
  visible: boolean
  /** The song this entry's note belongs to — the title names the field. */
  title: string
  /** Controlled text (see `SetlistBlockDialog` on why not state-in-effect). */
  note: string
  onChangeNote: (note: string) => void
  onClose: () => void
  onSubmit: (note: string) => void
}

/**
 * The band's shared cue for one entry of a setlist — "tune Eb", "starts
 * alone" (roadmap #43). Saving an empty value clears the note: unlike a
 * divider, a note may legitimately be taken back, so confirm stays enabled.
 */
export function SetlistNoteDialog({
  visible,
  title,
  note,
  onChangeNote,
  onClose,
  onSubmit,
}: SetlistNoteDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={t("setlists.songNoteTitle", { title })}
      confirmLabel={t("common.save")}
      onConfirm={() => onSubmit(note)}
    >
      <Input
        label={t("setlists.noteLabel")}
        hint={t("setlists.noteHint")}
        placeholder={t("setlists.notePlaceholder")}
        value={note}
        onChangeText={onChangeNote}
        multiline
        maxLength={MAX_SONG_NOTE}
      />
    </Dialog>
  )
}

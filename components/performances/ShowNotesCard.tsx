import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Card } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { useToast } from "@/components/ui/Toast"
import { TrashIcon } from "@/components/ui/Icons"
import { ShowNoteDialog } from "@/components/performances/ShowNoteDialog"
import { useShowNotes } from "@/hooks/useShowNotes"
import { appendShowNote, removeShowNote } from "@/libs/showNotes"
import { toFriendlyError } from "@/services/errors"
import type { ShowNote } from "@/interfaces"

interface ShowNotesCardProps {
  organizationId: string
  performanceId: string
  /** The event's stored feed; the hook keeps a local copy over it. */
  storedNotes: readonly ShowNote[]
  /** songId → title, so a note says which song it was about. */
  songTitles: ReadonlyMap<string, string>
  currentUid: string
  isAdmin: boolean
  /** A guest reads the review but never writes to it (roadmap #59). */
  canWrite: boolean
  author: { id: string; name: string }
}

/**
 * The event's night notes, reviewed and corrected after the gig (roadmap #90).
 *
 * Every note carries the time it was written and the song that was on screen —
 * that pair is the context the show log cannot carry on its own ("PA died
 * here", "the bride asked for this one"). Edits are **write-through** like the
 * report's marks: adding or removing a note saves the whole feed, so there is no
 * draft to lose, and only the author or an admin may remove one.
 */
export function ShowNotesCard({
  organizationId,
  performanceId,
  storedNotes,
  songTitles,
  currentUid,
  isAdmin,
  canWrite,
  author,
}: ShowNotesCardProps) {
  const { t, i18n } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const toast = useToast()
  const { notes, save } = useShowNotes(organizationId, performanceId, storedNotes)

  const [draft, setDraft] = useState<{ songId: string; value: string } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ShowNote | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const timeOf = (at: number): string =>
    new Date(at).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })

  const saveNote = async (): Promise<void> => {
    if (!draft) return
    setSaving(true)
    try {
      await save(
        appendShowNote(
          notes,
          {
            songId: draft.songId,
            body: draft.value,
            authorId: author.id,
            authorName: author.name,
          },
          Date.now(),
        ),
      )
      setDraft(null)
      toast.showSuccess(t("performances.showNoteSaved"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("performances.couldNotSaveNotes")))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (): Promise<void> => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await save(removeShowNote(notes, pendingDelete.id))
      setPendingDelete(null)
    } catch (error) {
      toast.showError(toFriendlyError(error, t("performances.couldNotDeleteNotes")))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <View style={styles.head}>
        <AppText variant="label" tone="faint">
          {t("performances.showNotesTitle")}
        </AppText>
        {canWrite ? (
          <Button
            label={t("performances.showNoteAdd")}
            variant="secondary"
            size="sm"
            onPress={() => setDraft({ songId: "", value: "" })}
          />
        ) : null}
      </View>

      {notes.length === 0 ? (
        <AppText variant="caption" tone="muted">
          {t("performances.showNoteEmpty")}
        </AppText>
      ) : null}

      {notes.map((note) => {
        const songTitle = note.songId ? (songTitles.get(note.songId) ?? "") : ""
        const canRemove = canWrite && (note.authorId === currentUid || isAdmin)
        return (
          <View key={note.id} style={styles.note}>
            <View style={styles.noteHead}>
              <AppText variant="caption" tone="primary">
                {timeOf(note.at)}
              </AppText>
              <AppText variant="caption" tone="faint" numberOfLines={1} style={styles.flex}>
                {songTitle || t("performances.showNoteGeneral")}
              </AppText>
              {canRemove ? (
                <IconButton
                  icon={<TrashIcon size={15} color={Theme.colors.textFaint} />}
                  label={t("performances.showNoteDeleteAction")}
                  size={26}
                  onPress={() => setPendingDelete(note)}
                />
              ) : null}
            </View>
            <AppText variant="body" numberOfLines={4}>
              {note.body}
            </AppText>
            <AppText variant="caption" tone="faint" numberOfLines={1}>
              {note.authorName}
            </AppText>
          </View>
        )
      })}

      <ShowNoteDialog
        visible={draft !== null}
        songTitle=""
        value={draft?.value ?? ""}
        onChangeText={(value) =>
          setDraft((current) => (current ? { ...current, value } : current))
        }
        onClose={() => setDraft(null)}
        onSave={() => void saveNote()}
        saving={saving}
      />

      <Dialog
        visible={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t("performances.showNoteDeleteTitle")}
        description={t("performances.showNoteDeleteDescription")}
        confirmLabel={t("performances.showNoteDeleteAction")}
        tone="danger"
        confirmLoading={deleting}
        onConfirm={() => void remove()}
      />
    </Card>
  )
}

const createStyles = () =>
  StyleSheet.create({
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Theme.spacing.m },
    note: {
      gap: 2,
      paddingVertical: Theme.spacing.s,
      borderTopWidth: 1,
      borderTopColor: Theme.colors.borderSoft,
    },
    noteHead: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    flex: { flex: 1, minWidth: 0 },
  })

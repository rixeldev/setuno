import React, { useState } from "react"
import { Linking, Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button, IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { useToast } from "@/components/ui/Toast"
import {
  FilePdfIcon,
  LinkIcon,
  OpenExternalIcon,
  PaperclipIcon,
  TrashIcon,
} from "@/components/ui/Icons"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import {
  ATTACHMENT_FILE_MAX_BYTES,
  ATTACHMENT_NAME_MAX,
  ATTACHMENT_NOTE_MAX,
  MAX_SONG_ATTACHMENTS,
  attachmentBaseName,
  attachmentSize,
  isPdfFileName,
  linkHost,
} from "@/libs/songAttachments"
import { pickAttachmentPdf } from "@/libs/importFiles"
import {
  addSongAttachmentFile,
  addSongAttachmentLink,
  removeSongAttachment,
} from "@/services/songAttachments"
import { toFriendlyError } from "@/services/errors"
import type { PickedFile } from "@/interfaces/pickedFile"
import type { Song, SongAttachment } from "@/interfaces"

interface AttachmentsEditorProps {
  /** Only ever rendered while editing an existing song — attachments need an id. */
  song: Song
}

/**
 * The "Attachments" block inside the song form's More details (roadmap #40):
 * a PDF chart or an arbitrary link (rehearsal recording, shared Drive file),
 * each carrying its own note. Adds and removals **write through immediately**
 * — attachments are files, not draft fields — so cancelling the lyrics form
 * keeps them, and a save can never clobber what a teammate just attached. The
 * cap is checked before any bytes move, and the upload itself happens only
 * after the confirm dialog has the label and note.
 */
export function AttachmentsEditor({ song }: AttachmentsEditorProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const toast = useToast()
  const { organizationId } = useOrganization()
  const { profile } = useAuth()

  const [busy, setBusy] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkName, setLinkName] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [linkNote, setLinkNote] = useState("")
  const [pendingFile, setPendingFile] = useState<PickedFile | null>(null)
  const [fileName, setFileName] = useState("")
  const [fileNote, setFileNote] = useState("")
  const [removeTarget, setRemoveTarget] = useState<SongAttachment | null>(null)

  const attachments = song.attachments
  const atLimit = attachments.length >= MAX_SONG_ATTACHMENTS
  const actor = { name: profile?.displayName || "An admin" }
  const pendingSize = pendingFile ? attachmentSize(pendingFile.size) : null
  const pendingDescription =
    pendingFile && pendingSize
      ? `${pendingFile.name} · ${t(pendingSize.key, { value: pendingSize.value })}`
      : undefined

  const confirmLink = async () => {
    if (busy) return
    setBusy(true)
    try {
      await addSongAttachmentLink(
        organizationId ?? "",
        song.id,
        { name: linkName, url: linkUrl, note: linkNote },
        actor,
      )
      setLinkOpen(false)
      setLinkName("")
      setLinkUrl("")
      setLinkNote("")
      toast.showSuccess(t("attachments.linkAdded"))
    } catch (error) {
      toast.showError(toFriendlyError(error))
    } finally {
      setBusy(false)
    }
  }

  /** Picker → client validation (extension + size, localized) → confirm dialog. */
  const pickPdf = async () => {
    const picked = await pickAttachmentPdf()
    if (!picked) return
    if (!isPdfFileName(picked.name)) {
      toast.showError(t("attachments.notPdf"))
      return
    }
    if (picked.size > ATTACHMENT_FILE_MAX_BYTES) {
      toast.showError(t("attachments.tooLarge"))
      return
    }
    setFileName(attachmentBaseName(picked.name))
    setFileNote("")
    setPendingFile(picked)
  }

  const confirmFile = async () => {
    if (!pendingFile || busy) return
    setBusy(true)
    try {
      await addSongAttachmentFile(
        organizationId ?? "",
        song.id,
        pendingFile,
        { name: fileName, note: fileNote },
        actor,
      )
      setPendingFile(null)
      toast.showSuccess(t("attachments.fileAdded"))
    } catch (error) {
      toast.showError(toFriendlyError(error))
    } finally {
      setBusy(false)
    }
  }

  const confirmRemove = async () => {
    if (!removeTarget || busy) return
    setBusy(true)
    try {
      await removeSongAttachment(organizationId ?? "", song.id, removeTarget.id)
      setRemoveTarget(null)
      toast.showSuccess(t("attachments.removed"))
    } catch (error) {
      toast.showError(toFriendlyError(error))
    } finally {
      setBusy(false)
    }
  }

  /** Kind · size (files) or kind · host (links) — the row's metadata line. */
  const captionFor = (entry: SongAttachment): string => {
    if (entry.kind === "file") {
      const size = attachmentSize(entry.size)
      return [t("attachments.kindFile"), t(size.key, { value: size.value })].join(" · ")
    }
    const host = linkHost(entry.url)
    return [t("attachments.kindLink"), host].filter(Boolean).join(" · ")
  }

  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <AppText variant="label" tone="faint">
          {t("attachments.title")}
        </AppText>
        <AppText variant="caption" tone="muted">
          {t("attachments.help")}
        </AppText>
      </View>

      {attachments.length === 0 ? (
        <AppText variant="caption" tone="faint">
          {t("attachments.empty")}
        </AppText>
      ) : (
        attachments.map((entry) => (
          <View key={entry.id} style={styles.row}>
            <Pressable
              onPress={() => void Linking.openURL(entry.url).catch(() => undefined)}
              accessibilityRole="link"
              accessibilityLabel={t("attachments.openA11y", { name: entry.name })}
              style={({ pressed }) => [styles.entry, pressed && styles.pressed]}
            >
              {entry.kind === "file" ? (
                <FilePdfIcon size={18} color={Theme.colors.accent} />
              ) : (
                <LinkIcon size={18} color={Theme.colors.accent} />
              )}
              <View style={styles.entryText}>
                <AppText variant="body" numberOfLines={1}>
                  {entry.name}
                </AppText>
                <AppText variant="caption" tone="faint" numberOfLines={1}>
                  {captionFor(entry)}
                </AppText>
                {entry.note ? (
                  <AppText variant="caption" tone="muted" numberOfLines={2}>
                    {entry.note}
                  </AppText>
                ) : null}
              </View>
              <OpenExternalIcon size={14} color={Theme.colors.textMuted} />
            </Pressable>
            <IconButton
              icon={<TrashIcon size={18} color={Theme.colors.textMuted} />}
              label={t("attachments.removeA11y", { name: entry.name })}
              onPress={() => setRemoveTarget(entry)}
              size={36}
            />
          </View>
        ))
      )}

      <View style={styles.actions}>
        <Button
          variant="ghost"
          size="sm"
          icon={<PaperclipIcon size={16} color={Theme.colors.primary} />}
          label={t("attachments.addLink")}
          onPress={() => setLinkOpen(true)}
          disabled={atLimit || busy}
        />
        <Button
          variant="ghost"
          size="sm"
          icon={<FilePdfIcon size={16} color={Theme.colors.primary} />}
          label={t("attachments.uploadPdf")}
          onPress={() => void pickPdf()}
          disabled={atLimit || busy}
        />
      </View>

      {atLimit ? (
        <AppText variant="caption" tone="muted">
          {t("attachments.limitHint", { max: MAX_SONG_ATTACHMENTS })}
        </AppText>
      ) : null}

      <Dialog
        visible={linkOpen}
        onClose={() => setLinkOpen(false)}
        title={t("attachments.addLinkTitle")}
        description={t("attachments.addLinkHelp")}
        confirmLabel={t("attachments.addLinkAction")}
        onConfirm={() => void confirmLink()}
        confirmLoading={busy}
        confirmDisabled={linkUrl.trim().length === 0}
      >
        <Input
          label={t("attachments.linkLabel")}
          value={linkName}
          onChangeText={setLinkName}
          placeholder={t("attachments.namePlaceholder")}
          maxLength={ATTACHMENT_NAME_MAX}
        />
        <Input
          label={t("attachments.linkUrl")}
          value={linkUrl}
          onChangeText={setLinkUrl}
          placeholder="https://…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Input
          label={t("attachments.note")}
          value={linkNote}
          onChangeText={setLinkNote}
          placeholder={t("attachments.notePlaceholder")}
          hint={t("attachments.noteHelp")}
          multiline
          maxLength={ATTACHMENT_NOTE_MAX}
        />
      </Dialog>

      <Dialog
        visible={pendingFile !== null}
        onClose={() => setPendingFile(null)}
        title={t("attachments.confirmFileTitle")}
        description={pendingDescription}
        confirmLabel={t("attachments.attach")}
        onConfirm={() => void confirmFile()}
        confirmLoading={busy}
      >
        <Input
          label={t("attachments.fileName")}
          value={fileName}
          onChangeText={setFileName}
          maxLength={ATTACHMENT_NAME_MAX}
        />
        <Input
          label={t("attachments.note")}
          value={fileNote}
          onChangeText={setFileNote}
          placeholder={t("attachments.notePlaceholder")}
          hint={t("attachments.noteHelp")}
          multiline
          maxLength={ATTACHMENT_NOTE_MAX}
        />
      </Dialog>

      <Dialog
        visible={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title={t("attachments.removeTitle")}
        description={
          removeTarget ? t("attachments.removeBody", { name: removeTarget.name }) : undefined
        }
        confirmLabel={t("common.delete")}
        tone="danger"
        onConfirm={() => void confirmRemove()}
        confirmLoading={busy}
      />
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    block: {
      gap: Theme.spacing.s,
    },
    header: {
      gap: 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.xs,
    },
    entry: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      paddingVertical: 6,
      paddingHorizontal: Theme.spacing.s,
      borderRadius: Theme.radii.m,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.surface,
    },
    entryText: {
      flex: 1,
      gap: 1,
    },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Theme.spacing.s,
    },
    pressed: { opacity: 0.7 },
  })

import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { AppText } from "@/components/ui/AppText"
import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { PlusIcon } from "@/components/ui/Icons"
import { useToast } from "@/components/ui/Toast"
import { useCollections } from "@/hooks/useCollections"
import { collectionName } from "@/libs/personalCollections"
import { toFriendlyError } from "@/services/errors"
import type { Song } from "@/interfaces"

interface AddToCollectionSheetProps {
  visible: boolean
  onClose: () => void
  /** The song being filed — `null` keeps the sheet inert while closed. */
  song: Song | null
}

/**
 * "Add to collection…" (roadmap #33): file a song into one of this user's
 * private collections, or start a new one in the same motion. Only the song's
 * id is written — a collection never holds a copy of the song, so it stays a
 * personal pointer and the shared document is untouched.
 */
export function AddToCollectionSheet({ visible, onClose, song }: AddToCollectionSheetProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { collections, create, addSongs } = useCollections()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  const add = async (collectionId: string, displayName: string): Promise<void> => {
    if (!song) return
    try {
      await addSongs(collectionId, [song.id])
      toast.showSuccess(t("collections.addedTo", { title: song.title, name: displayName }))
      onClose()
    } catch (cause) {
      toast.showError(toFriendlyError(cause, t("collections.couldNotSave")))
    }
  }

  const createAndAdd = async (): Promise<void> => {
    if (!song || collectionName(name) === null) return
    setSaving(true)
    try {
      const displayName = collectionName(name) ?? ""
      await create(displayName, [song.id])
      toast.showSuccess(t("collections.addedTo", { title: song.title, name: displayName }))
      setCreating(false)
      setName("")
      onClose()
    } catch (cause) {
      toast.showError(toFriendlyError(cause, t("collections.couldNotSave")))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <BottomSheet
        visible={visible && !creating}
        onClose={onClose}
        title={t("collections.addToTitle", { title: song?.title ?? "" })}
        subtitle={t("collections.addToHint")}
      >
        {collections.map((collection) => (
          <SheetOptionRow
            key={collection.id}
            label={collection.name || t("collections.untitled")}
            hint={t("collections.songCount", { count: collection.songIds.length })}
            onPress={() => void add(collection.id, collection.name)}
          />
        ))}
        {collections.length === 0 ? (
          <AppText variant="caption" tone="muted">
            {t("collections.emptyMessage")}
          </AppText>
        ) : null}
        <SheetOptionRow
          label={t("collections.addToNew")}
          onPress={() => setCreating(true)}
          trailing={<PlusIcon size={18} color={Theme.colors.textMuted} />}
        />
      </BottomSheet>

      <Dialog
        visible={creating}
        onClose={() => setCreating(false)}
        title={t("collections.newCollection")}
        confirmLabel={t("common.save")}
        confirmDisabled={collectionName(name) === null}
        confirmLoading={saving}
        onConfirm={() => void createAndAdd()}
      >
        <Input
          label={t("collections.name")}
          placeholder={t("collections.namePlaceholder")}
          value={name}
          onChangeText={setName}
          autoFocus
          onSubmitEditing={() => void createAndAdd()}
        />
      </Dialog>
    </>
  )
}

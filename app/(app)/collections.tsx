import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { IconButton } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { DotsIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons"
import { ModalScreen } from "@/components/app/ModalScreen"
import { useToast } from "@/components/ui/Toast"
import { useCollections } from "@/hooks/useCollections"
import { collectionName } from "@/libs/personalCollections"
import { toFriendlyError } from "@/services/errors"
import type { UserCollection } from "@/interfaces"

/**
 * The list of this user's private collections (roadmap #33) — personal setlist
 * drafts that are never visible to other members. Create, rename and delete
 * live here; songs are filed from the reader's "Add to collection…".
 */
export default function CollectionsScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { collections, loading, error, create, rename, remove } = useCollections()

  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<UserCollection | null>(null)
  const [menuFor, setMenuFor] = useState<UserCollection | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<UserCollection | null>(null)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const displayName = collectionName(name)
  const labelFor = (collection: UserCollection): string => collection.name || t("collections.untitled")

  const openCreate = (): void => {
    setName("")
    setCreating(true)
  }

  const submitName = async (): Promise<void> => {
    if (displayName === null || saving) return
    setSaving(true)
    try {
      if (renaming !== null) {
        await rename(renaming.id, displayName)
        setRenaming(null)
      } else {
        await create(displayName)
        toast.showSuccess(t("collections.created", { name: displayName }))
        setCreating(false)
      }
      setName("")
    } catch (cause) {
      toast.showError(toFriendlyError(cause, t("collections.couldNotSave")))
    } finally {
      setSaving(false)
    }
  }

  const confirmRemoval = async (): Promise<void> => {
    if (confirmDelete === null || deleting) return
    setDeleting(true)
    try {
      await remove(confirmDelete.id)
      toast.showSuccess(t("collections.deleted", { name: labelFor(confirmDelete) }))
      setConfirmDelete(null)
    } catch (cause) {
      toast.showError(toFriendlyError(cause, t("collections.couldNotSave")))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ModalScreen
      title={t("collections.title")}
      subtitle={
        loading ? t("collections.loading") : t("collections.count", { count: collections.length })
      }
      headerRight={
        <IconButton
          label={t("collections.newCollection")}
          variant="secondary"
          onPress={openCreate}
          icon={<PlusIcon size={18} color={Theme.colors.text} />}
        />
      }
    >
      {error ? <ErrorState message={error} /> : null}

      {loading ? (
        <SkeletonList count={3} height={72} />
      ) : collections.length === 0 ? (
        error ? null : (
          <EmptyState
            title={t("collections.empty")}
            message={t("collections.emptyMessage")}
            actionLabel={t("collections.newCollection")}
            onAction={openCreate}
          />
        )
      ) : (
        <View style={styles.list}>
          {collections.map((collection) => (
            <Card key={collection.id} onPress={() => router.push(`/collections/${collection.id}`)}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <AppText variant="body" numberOfLines={1}>
                    {labelFor(collection)}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {t("collections.songCount", { count: collection.songIds.length })}
                  </AppText>
                </View>
                <IconButton
                  label={t("collections.menuA11y", { name: labelFor(collection) })}
                  variant="secondary"
                  onPress={() => setMenuFor(collection)}
                  icon={<DotsIcon size={18} color={Theme.colors.text} />}
                />
              </View>
            </Card>
          ))}
        </View>
      )}

      <BottomSheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor !== null ? labelFor(menuFor) : ""}
      >
        <SheetOptionRow
          label={t("collections.rename")}
          onPress={() => {
            const target = menuFor
            setMenuFor(null)
            if (target !== null) {
              setName(target.name)
              setRenaming(target)
            }
          }}
          trailing={<PencilIcon size={18} color={Theme.colors.textMuted} />}
        />
        <SheetOptionRow
          label={t("collections.delete")}
          onPress={() => {
            const target = menuFor
            setMenuFor(null)
            if (target !== null) setConfirmDelete(target)
          }}
          trailing={<TrashIcon size={18} color={Theme.colors.danger} />}
        />
      </BottomSheet>

      <Dialog
        visible={creating || renaming !== null}
        onClose={() => {
          setCreating(false)
          setRenaming(null)
          setName("")
        }}
        title={renaming !== null ? t("collections.rename") : t("collections.newCollection")}
        confirmLabel={t("common.save")}
        confirmDisabled={displayName === null}
        confirmLoading={saving}
        onConfirm={() => void submitName()}
      >
        <Input
          label={t("collections.name")}
          placeholder={t("collections.namePlaceholder")}
          value={name}
          onChangeText={setName}
          autoFocus
          onSubmitEditing={() => void submitName()}
        />
      </Dialog>

      <Dialog
        visible={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={t("collections.deleteConfirm", {
          name: confirmDelete !== null ? labelFor(confirmDelete) : "",
        })}
        description={t("collections.deleteDescription")}
        confirmLabel={t("collections.delete")}
        tone="danger"
        confirmLoading={deleting}
        onConfirm={() => void confirmRemoval()}
      />
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    list: { gap: Theme.spacing.s },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
    },
    rowText: { flex: 1, minWidth: 0, gap: 2 },
  })

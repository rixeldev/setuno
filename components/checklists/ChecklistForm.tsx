import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button, IconButton } from "@/components/ui/Button"
import { Card, Chip } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Dialog } from "@/components/ui/Dialog"
import { useToast } from "@/components/ui/Toast"
import { ModalScreen } from "@/components/app/ModalScreen"
import { DiscardChangesDialog } from "@/components/app/DiscardChangesDialog"
import { PlusIcon, TrashIcon } from "@/components/ui/Icons"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import {
  createChecklist,
  deleteChecklist,
  updateChecklist,
} from "@/services/checklists"
import { toFriendlyError } from "@/services/errors"
import { CHECKLIST_ITEMS_MAX, CHECKLIST_KINDS } from "@/libs/checklistTemplates"
import { CHECKLIST_KIND_KEYS } from "@/interfaces/checklist"
import type { ChecklistKind, ChecklistTemplate } from "@/interfaces"

/** One item row while editing; `key` is local React state, never stored. */
interface ItemRow {
  key: string
  title: string
}

const rowId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const rowFrom = (title: string): ItemRow => ({ key: rowId(), title })

/** Stable snapshot used to detect unsaved changes. */
const serializeForm = (name: string, kind: ChecklistKind, rows: ItemRow[]): string =>
  JSON.stringify({ name, kind, items: rows.map((row) => row.title) })

interface ChecklistFormProps {
  /** The checklist being edited, or null on the create route. */
  template: ChecklistTemplate | null
}

/**
 * Checklist form (roadmap #49): a name, its kind and the item titles. Any
 * member maintains the band's checklists — the rules pin that — so there is
 * no admin gate. The edit mode seeds its fields from the subscribed
 * template once at mount (the screen only renders the form after the load),
 * and Delete lives in its header behind the usual confirmation.
 */
export function ChecklistForm({ template }: ChecklistFormProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const { profile } = useAuth()
  const { organizationId, isAdmin } = useOrganization()

  const [name, setName] = useState(template?.name ?? "")
  const [kind, setKind] = useState<ChecklistKind>(template?.kind ?? "gear")
  const [rows, setRows] = useState<ItemRow[]>(() => (template?.items ?? []).map(rowFrom))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [baseline, setBaseline] = useState(() =>
    serializeForm(template?.name ?? "", template?.kind ?? "gear", (template?.items ?? []).map(rowFrom)),
  )

  const hasUnsavedChanges = serializeForm(name, kind, rows) !== baseline && !saving
  const leaveGuard = useUnsavedChanges(hasUnsavedChanges)

  // The rules' own delete gate: its creator or an admin.
  const canDelete = Boolean(template && (isAdmin || (profile?.uid ?? "") === template.createdBy))

  const setRow = (key: string, title: string): void => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, title } : row)))
    setErrors({})
  }
  const addRow = (): void => setRows((current) => [...current, rowFrom("")])
  const removeRow = (key: string): void =>
    setRows((current) => current.filter((row) => row.key !== key))

  const save = async (): Promise<void> => {
    const filled = rows.filter((row) => row.title.trim().length > 0)
    const next: Record<string, string> = {}
    if (name.trim().length === 0) next.name = t("checklists.nameRequired")
    if (filled.length === 0) next.items = t("checklists.itemsRequired")
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const input = {
      name: name.trim(),
      kind,
      items: filled.map((row) => row.title.trim()),
    }
    setSaving(true)
    try {
      if (template) {
        await updateChecklist(organizationId ?? "", template.id, input)
        toast.showSuccess(t("checklists.checklistSaved"))
        setBaseline(serializeForm(name, kind, rows))
      } else {
        const id = await createChecklist(organizationId ?? "", input)
        toast.showSuccess(t("checklists.checklistCreated", { name: input.name }))
        setBaseline(serializeForm(name, kind, rows))
        router.replace(`/checklists/${id}`)
      }
    } catch (error) {
      toast.showError(toFriendlyError(error, t("checklists.couldNotSave")))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (): Promise<void> => {
    if (!template) return
    setConfirmDelete(false)
    setSaving(true)
    try {
      await deleteChecklist(organizationId ?? "", template.id)
      toast.showSuccess(t("checklists.checklistDeleted"))
      router.back()
    } catch (error) {
      toast.showError(toFriendlyError(error, t("checklists.couldNotDelete")))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalScreen
      title={template ? t("checklists.editChecklist") : t("checklists.newChecklist")}
      headerRight={
        template && canDelete ? (
          <IconButton
            icon={<TrashIcon size={18} color={Theme.colors.danger} />}
            onPress={() => setConfirmDelete(true)}
            label={t("checklists.deleteChecklist")}
          />
        ) : null
      }
    >
      <Card style={styles.card}>
        <Input
          label={t("checklists.nameLabel")}
          placeholder={t("checklists.namePlaceholder")}
          value={name}
          onChangeText={setName}
          error={errors.name ?? null}
          maxLength={80}
        />

        <AppText variant="label" tone="faint">
          {t("checklists.kindLabel")}
        </AppText>
        <View style={styles.kinds}>
          {CHECKLIST_KINDS.map((entry) => (
            <Chip
              key={entry}
              label={t(CHECKLIST_KIND_KEYS[entry])}
              tone="primary"
              selected={kind === entry}
              onPress={() => setKind(entry)}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <AppText variant="label" tone="faint">
          {t("checklists.itemsLabel")}
        </AppText>

        {rows.map((row, index) => (
          <View key={row.key} style={styles.row}>
            <Input
              label={`${t("checklists.itemOption")} ${index + 1}`}
              placeholder={t("checklists.itemPlaceholder")}
              value={row.title}
              onChangeText={(title) => setRow(row.key, title)}
              maxLength={120}
            />
            <IconButton
              icon={<TrashIcon size={16} color={Theme.colors.textMuted} />}
              onPress={() => removeRow(row.key)}
              label={t("checklists.removeItem")}
            />
          </View>
        ))}

        {errors.items ? (
          <AppText variant="caption" tone="danger">
            {errors.items}
          </AppText>
        ) : null}

        {rows.length < CHECKLIST_ITEMS_MAX ? (
          <Button
            label={t("checklists.addItem")}
            variant="ghost"
            size="sm"
            icon={<PlusIcon size={18} color={Theme.colors.text} />}
            onPress={addRow}
          />
        ) : (
          <AppText variant="caption" tone="faint">
            {t("checklists.tooManyItems")}
          </AppText>
        )}
      </Card>

      <View style={styles.actions}>
        <Button
          label={t("common.cancel")}
          variant="ghost"
          onPress={() => router.back()}
          style={styles.action}
        />
        <Button
          label={t("common.save")}
          loading={saving}
          onPress={() => void save()}
          style={styles.action}
        />
      </View>

      <DiscardChangesDialog
        visible={leaveGuard.confirmVisible}
        what={t("checklists.discardWhat")}
        onKeepEditing={leaveGuard.keepEditing}
        onDiscard={leaveGuard.discardAndLeave}
      />

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        tone="danger"
        title={t("checklists.deleteConfirm", { name: template?.name ?? "" })}
        description={t("checklists.deleteDescription")}
        confirmLabel={t("common.delete")}
        onConfirm={() => void remove()}
      />
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.m },
    kinds: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.xs },
    row: { flexDirection: "row", alignItems: "flex-end", gap: Theme.spacing.s },
    actions: { flexDirection: "row", gap: Theme.spacing.s },
    action: { flex: 1 },
  })

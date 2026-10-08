import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { DateField } from "@/components/ui/DateField"
import { useToast } from "@/components/ui/Toast"
import { ModalScreen } from "@/components/app/ModalScreen"
import { DiscardChangesDialog } from "@/components/app/DiscardChangesDialog"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"
import { createSetlist, setlistSongKeys, updateSetlist } from "@/services/setlists"
import { toFriendlyError } from "@/services/errors"
import { parseIsoDate, validateRequired } from "@/libs/validation"
import type { Setlist, SetlistInput } from "@/interfaces"

interface SetlistFormProps {
  /** Present when editing. */
  setlist?: Setlist | null
  onSaved?: (setlistId: string) => void
}

interface SetlistFormState {
  name: string
  description: string
  date: string
  notes: string
}

/** Stable snapshot used to detect unsaved changes. */
const serializeForm = (state: SetlistFormState): string => JSON.stringify(state)

const formStateFrom = (setlist: Setlist | null | undefined): SetlistFormState => ({
  name: setlist?.name ?? "",
  description: setlist?.description ?? "",
  date: setlist?.date ?? "",
  notes: setlist?.notes ?? "",
})

/** Create/edit form for a setlist (docs §20), presented as a modal. Songs are added on the detail screen. */
export function SetlistForm({ setlist, onSaved }: SetlistFormProps) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { profile } = useAuth()
  const { organizationId } = useOrganization()
  const { songLibrary } = useOrgData()

  const [name, setName] = useState(setlist?.name ?? "")
  const [description, setDescription] = useState(setlist?.description ?? "")
  const [date, setDate] = useState(setlist?.date ?? "")
  const [notes, setNotes] = useState(setlist?.notes ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [baseline, setBaseline] = useState(() => serializeForm(formStateFrom(setlist)))

  const currentState: SetlistFormState = { name, description, date, notes }
  const hasUnsavedChanges = serializeForm(currentState) !== baseline && !saving
  const leaveGuard = useUnsavedChanges(hasUnsavedChanges)

  const save = async (): Promise<void> => {
    const next: Record<string, string> = {}
    const nameError = validateRequired(name, t("setlists.nameRequired"))
    if (nameError) next.name = nameError
    if (date.trim().length > 0 && parseIsoDate(date.trim()) === null) {
      next.date = t("setlists.invalidDate")
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const input: SetlistInput = {
      name: name.trim(),
      description: description.trim(),
      date: date.trim().length > 0 ? date.trim() : null,
      notes: notes.trim(),
      songIds: setlist?.songs.map((entry) => entry.songId) ?? [],
      songKeys: setlist ? setlistSongKeys(setlist.songs) : undefined,
    }

    setSaving(true)
    try {
      const author = { id: profile?.uid ?? "", name: profile?.displayName || "An admin" }
      if (setlist) {
        await updateSetlist(organizationId ?? "", setlist.id, input, songLibrary, author)
        toast.showSuccess(t("setlists.setlistUpdated", { name: input.name }))
        setBaseline(serializeForm(currentState))
        onSaved?.(setlist.id)
      } else {
        const id = await createSetlist(organizationId ?? "", input, songLibrary, author)
        toast.showSuccess(t("setlists.setlistCreated", { name: input.name }))
        setBaseline(serializeForm(currentState))
        onSaved?.(id)
      }
    } catch (error) {
      toast.showError(toFriendlyError(error, t("setlists.couldNotSave")))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalScreen
      title={setlist ? t("setlists.editSetlist") : t("setlists.newSetlist")}
      subtitle={t("setlists.formSubtitle")}
    >
      <Card style={styles.card}>
        <Input
          label={t("setlists.name")}
          required
          value={name}
          onChangeText={setName}
          placeholder={t("setlists.namePlaceholder")}
          error={errors.name}
          autoCapitalize="sentences"
        />
        <Input
          label={t("setlists.description")}
          value={description}
          onChangeText={setDescription}
          placeholder={t("setlists.descriptionPlaceholder")}
          multiline
        />
      </Card>

      <Card style={styles.card}>
        <AppText variant="label" tone="faint">
          {t("setlists.dateAndNotes")}
        </AppText>
        <DateField
          label={t("setlists.date")}
          value={date || null}
          onChange={(iso) => setDate(iso)}
          error={errors.date}
        />
        <Input
          label={t("setlists.notes")}
          value={notes}
          onChangeText={setNotes}
          placeholder={t("setlists.notesPlaceholder")}
          multiline
        />
      </Card>

      {setlist ? (
        <AppText variant="caption" tone="faint">
          {t("setlists.songsInSetlist", { count: setlist.songs.length })}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <Button label={t("common.cancel")} variant="ghost" onPress={() => router.back()} style={styles.action} />
        <Button
          label={setlist ? t("setlists.saveChanges") : t("setlists.createSetlist")}
          loading={saving}
          onPress={() => void save()}
          style={styles.action}
        />
      </View>

      <DiscardChangesDialog
        visible={leaveGuard.confirmVisible}
        what={t("setlists.discardWhat")}
        onKeepEditing={leaveGuard.keepEditing}
        onDiscard={leaveGuard.discardAndLeave}
      />
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.m },
    actions: { flexDirection: "row", gap: Theme.spacing.m },
    action: { flex: 1 },
  })

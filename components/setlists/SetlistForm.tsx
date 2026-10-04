import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { PageHeader } from "@/components/ui/PageHeader"
import { useToast } from "@/components/ui/Toast"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { createSetlist, updateSetlist } from "@/services/setlists"
import { toFriendlyError } from "@/services/errors"
import { parseIsoDate, validateRequired } from "@/libs/validation"
import type { Setlist, SetlistInput } from "@/interfaces"

interface SetlistFormProps {
  /** Present when editing. */
  setlist?: Setlist | null
  onSaved?: (setlistId: string) => void
}

/** Create/edit form for a setlist (docs §20). Songs are added on the detail screen. */
export function SetlistForm({ setlist, onSaved }: SetlistFormProps) {
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

  const save = async (): Promise<void> => {
    const next: Record<string, string> = {}
    const nameError = validateRequired(name, "Give the setlist a name.")
    if (nameError) next.name = nameError
    if (date.trim().length > 0 && parseIsoDate(date.trim()) === null) {
      next.date = "Use the format yyyy-mm-dd."
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const input: SetlistInput = {
      name: name.trim(),
      description: description.trim(),
      date: date.trim().length > 0 ? date.trim() : null,
      notes: notes.trim(),
      songIds: setlist?.songs.map((entry) => entry.songId) ?? [],
    }

    setSaving(true)
    try {
      const author = { id: profile?.uid ?? "", name: profile?.displayName || "An admin" }
      if (setlist) {
        await updateSetlist(organizationId ?? "", setlist.id, input, songLibrary, author)
        toast.showSuccess(`"${input.name}" was updated.`)
        onSaved?.(setlist.id)
      } else {
        const id = await createSetlist(organizationId ?? "", input, songLibrary, author)
        toast.showSuccess(`"${input.name}" was created.`)
        onSaved?.(id)
      }
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't save that setlist."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.host}>
      <PageHeader
        title={setlist ? "Edit setlist" : "New setlist"}
        subtitle="Name it, date it, then add songs"
        back
        elevated
      />

      <ScreenContainer scroll style={styles.body}>
        <Card style={styles.card}>
          <Input
            label="Name"
            required
            value={name}
            onChangeText={setName}
            placeholder="Friday at The Blue Room"
            error={errors.name}
            autoCapitalize="sentences"
          />
          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Two 45 minute sets with a break"
            multiline
          />
        </Card>

        <Card style={styles.card}>
          <AppText variant="label" tone="faint">
            Date and notes
          </AppText>
          <Input
            label="Date"
            value={date}
            onChangeText={setDate}
            placeholder="2026-10-24"
            hint="Optional. Used to show the day on the setlist."
            error={errors.date}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
          <Input
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Bring the capo for the last three songs"
            multiline
          />
        </Card>

        {setlist ? (
          <AppText variant="caption" tone="faint">
            {setlist.songs.length} song(s) in this setlist. Add or remove them from the setlist screen.
          </AppText>
        ) : null}

        <View style={styles.actions}>
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} style={styles.action} />
          <Button
            label={setlist ? "Save changes" : "Create setlist"}
            loading={saving}
            onPress={() => void save()}
            style={styles.action}
          />
        </View>
      </ScreenContainer>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1, backgroundColor: Theme.colors.background },
    body: { paddingTop: Theme.spacing.l },
    card: { gap: Theme.spacing.m },
    actions: { flexDirection: "row", gap: Theme.spacing.m },
    action: { flex: 1 },
  })
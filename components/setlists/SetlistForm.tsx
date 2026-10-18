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
import { createSetlist, setlistSongKeys, setlistSongNotes, updateSetlist } from "@/services/setlists"
import { toFriendlyError } from "@/services/errors"
import { logFunnelEvent } from "@/services/telemetry"
import { parseIsoDate, validateRequired } from "@/libs/validation"
import {
  MAX_BREAK_MINUTES,
  MAX_GOAL_MINUTES,
  parseGoalMinutes,
} from "@/libs/setlistDuration"
import { firstFunnelEvent, FUNNEL_EVENTS } from "@/libs/telemetry"
import type { Setlist, SetlistInput } from "@/interfaces"

interface SetlistFormProps {
  /** Present when editing. */
  setlist?: Setlist | null
  onSaved?: (setlistId: string) => void
  /** Name pre-filled from a private collection the draft starts from (roadmap #33). */
  draftName?: string
  /** Songs the draft starts with — the form itself never edits them. */
  draftSongIds?: string[]
}

interface SetlistFormState {
  name: string
  description: string
  date: string
  notes: string
  /** Minutes, as typed — the field is free text until it is parsed on save. */
  targetMinutes: string
  breakMinutes: string
}

/** Stable snapshot used to detect unsaved changes. */
const serializeForm = (state: SetlistFormState): string => JSON.stringify(state)

const formStateFrom = (setlist: Setlist | null | undefined, draftName = ""): SetlistFormState => ({
  name: setlist?.name ?? draftName,
  description: setlist?.description ?? "",
  date: setlist?.date ?? "",
  notes: setlist?.notes ?? "",
  // No goal is blank rather than "0": an empty field says "unset" in a way
  // a zero does not.
  targetMinutes: setlist && setlist.targetMinutes > 0 ? `${setlist.targetMinutes}` : "",
  breakMinutes: setlist && setlist.breakMinutes > 0 ? `${setlist.breakMinutes}` : "",
})

/** Create/edit form for a setlist (docs §20), presented as a modal. Songs are added on the detail screen. */
export function SetlistForm({ setlist, onSaved, draftName, draftSongIds }: SetlistFormProps) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { profile } = useAuth()
  const { organizationId } = useOrganization()
  const { songLibrary, setlists } = useOrgData()

  // Read once: the same snapshot seeds both the goal fields and the baseline
  // the leave guard compares against. `draftName` seeds a collection draft
  // (roadmap #33) — it is part of the baseline, so opening with it filled in
  // never counts as an edit.
  const initial = formStateFrom(setlist, draftName)
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(setlist?.description ?? "")
  const [date, setDate] = useState(setlist?.date ?? "")
  const [notes, setNotes] = useState(setlist?.notes ?? "")
  const [targetMinutes, setTargetMinutes] = useState(initial.targetMinutes)
  const [breakMinutes, setBreakMinutes] = useState(initial.breakMinutes)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [baseline, setBaseline] = useState(() => serializeForm(initial))

  const currentState: SetlistFormState = {
    name,
    description,
    date,
    notes,
    targetMinutes,
    breakMinutes,
  }
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
      songIds: setlist?.songs.map((entry) => entry.songId) ?? draftSongIds ?? [],
      // Parsed here so the field stays free text while typing: "45 min" and
      // "9999" both land as a sensible number instead of an error to fix.
      targetMinutes: parseGoalMinutes(targetMinutes, MAX_GOAL_MINUTES),
      breakMinutes: parseGoalMinutes(breakMinutes, MAX_BREAK_MINUTES),
      // The form never reorders anything, so the dividers and per-song notes
      // travel through untouched — leaving either out would wipe them the next
      // time somebody renamed this list.
      blocks: setlist?.blocks ?? [],
      songNotes: setlist ? setlistSongNotes(setlist.songs) : {},
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
        // The band's first *running order* is the funnel's step (#73): saved
        // templates (#41) sit in the same collection but never count — the
        // subscribed list also refreshes only after this write lands.
        const existing = setlists.filter((entry) => !entry.template).length
        const first = firstFunnelEvent(existing, FUNNEL_EVENTS.firstSetlist)
        if (first) logFunnelEvent(first, { organization_id: organizationId ?? "" })
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

      <Card style={styles.card}>
        <AppText variant="label" tone="faint">
          {t("setlists.goalSection")}
        </AppText>
        <Input
          label={t("setlists.targetMinutes")}
          hint={t("setlists.targetMinutesHint")}
          value={targetMinutes}
          onChangeText={setTargetMinutes}
          placeholder={t("setlists.targetMinutesPlaceholder")}
          keyboardType="numeric"
        />
        <Input
          label={t("setlists.breakMinutes")}
          hint={t("setlists.breakMinutesHint")}
          value={breakMinutes}
          onChangeText={setBreakMinutes}
          placeholder={t("setlists.breakMinutesPlaceholder")}
          keyboardType="numeric"
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

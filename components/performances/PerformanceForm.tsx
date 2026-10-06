import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card, Chip } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { DateField } from "@/components/ui/DateField"
import { TimeField } from "@/components/ui/TimeField"
import { Dialog } from "@/components/ui/Dialog"
import { useToast } from "@/components/ui/Toast"
import { ModalScreen } from "@/components/app/ModalScreen"
import { DiscardChangesDialog } from "@/components/app/DiscardChangesDialog"
import { MapPinIcon } from "@/components/ui/Icons"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"
import { createPerformance, updatePerformance } from "@/services/performances"
import { toFriendlyError } from "@/services/errors"
import { ISO_DATE_PATTERN, validateRequired, validateTime } from "@/libs/validation"
import type { Performance, PerformanceInput, PerformanceStatus } from "@/interfaces"

interface PerformanceFormProps {
  /** Present when editing an existing show. */
  performance?: Performance | null
  onSaved?: (performanceId: string) => void
}

interface PerformanceFormState {
  name: string
  date: string
  endDate: string | null
  startTime: string
  endTime: string
  venueName: string
  venueAddress: string
  venueNotes: string
  notes: string
  setlistId: string | null
  status: PerformanceStatus
}

/** Stable snapshot used to detect unsaved changes. */
const serializeForm = (state: PerformanceFormState): string => JSON.stringify(state)

const formStateFrom = (performance: Performance | null | undefined): PerformanceFormState => ({
  name: performance?.name ?? "",
  date: performance?.date ?? "",
  endDate: performance?.endDate ?? null,
  startTime: performance?.startTime ?? "",
  endTime: performance?.endTime ?? "",
  venueName: performance?.venue.name ?? "",
  venueAddress: performance?.venue.address ?? "",
  venueNotes: performance?.venue.notes ?? "",
  notes: performance?.notes ?? "",
  setlistId: performance?.setlistId ?? null,
  status: performance?.status ?? "scheduled",
})

const STATUSES: PerformanceStatus[] = ["scheduled", "completed", "cancelled"]

/**
 * Performance (gig) form (docs §22): date range, times, venue, notes, optional
 * setlist and status. Presented as a modal on both the new and edit routes.
 */
export function PerformanceForm({ performance, onSaved }: PerformanceFormProps) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { profile } = useAuth()
  const { organizationId } = useOrganization()
  const { setlists } = useOrgData()

  const [name, setName] = useState(performance?.name ?? "")
  const [date, setDate] = useState(performance?.date ?? "")
  const [endDate, setEndDate] = useState<string | null>(performance?.endDate ?? null)
  const [startTime, setStartTime] = useState(performance?.startTime ?? "")
  const [endTime, setEndTime] = useState(performance?.endTime ?? "")
  const [venueName, setVenueName] = useState(performance?.venue.name ?? "")
  const [venueAddress, setVenueAddress] = useState(performance?.venue.address ?? "")
  const [venueNotes, setVenueNotes] = useState(performance?.venue.notes ?? "")
  const [notes, setNotes] = useState(performance?.notes ?? "")
  const [setlistId, setSetlistId] = useState<string | null>(performance?.setlistId ?? null)
  const [status, setStatus] = useState<PerformanceStatus>(performance?.status ?? "scheduled")
  const [setlistPicker, setSetlistPicker] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [baseline, setBaseline] = useState(() => serializeForm(formStateFrom(performance)))

  const setlist = setlists.find((entry) => entry.id === setlistId) ?? null

  const currentState: PerformanceFormState = {
    name,
    date,
    endDate,
    startTime,
    endTime,
    venueName,
    venueAddress,
    venueNotes,
    notes,
    setlistId,
    status,
  }
  const hasUnsavedChanges = serializeForm(currentState) !== baseline && !saving
  const leaveGuard = useUnsavedChanges(hasUnsavedChanges)

  const save = async (): Promise<void> => {
    const next: Record<string, string> = {}
    const nameError = validateRequired(name, t("performances.nameRequired"))
    if (nameError) next.name = nameError
    if (!ISO_DATE_PATTERN.test(date.trim())) next.date = t("performances.dateRequired")
    if (endDate && endDate < date.trim()) next.endDate = t("performances.endDateError")
    const startError = validateTime(startTime.trim(), t("performances.startTime"))
    if (startError) next.startTime = startError
    const endError = validateTime(endTime.trim(), t("performances.endTime"))
    if (endError) next.endTime = endError
    if (startError === null && endError === null && startTime > endTime) {
      next.endTime = t("performances.endBeforeStart")
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const input: PerformanceInput = {
      name: name.trim(),
      date: date.trim(),
      endDate: endDate && endDate.length > 0 ? endDate : null,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      venue: {
        name: venueName.trim(),
        address: venueAddress.trim(),
        notes: venueNotes.trim(),
      },
      notes: notes.trim(),
      setlistId,
      status,
    }

    setSaving(true)
    try {
      const author = { id: profile?.uid ?? "", name: profile?.displayName || "An admin" }
      if (performance) {
        await updatePerformance(organizationId ?? "", performance.id, input, setlist?.name ?? null, author)
        toast.showSuccess(t("performances.performanceUpdated", { name: input.name }))
        setBaseline(serializeForm(currentState))
        onSaved?.(performance.id)
      } else {
        const id = await createPerformance(organizationId ?? "", input, setlist?.name ?? null, author)
        toast.showSuccess(t("performances.performanceCreated", { name: input.name }))
        setBaseline(serializeForm(currentState))
        onSaved?.(id)
      }
    } catch (error) {
      toast.showError(toFriendlyError(error, t("performances.couldNotSave")))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalScreen
      title={performance ? t("performances.editPerformance") : t("performances.newPerformance")}
      subtitle={t("performances.formSubtitle")}
    >
      <Card style={styles.card}>
        <Input
          label={t("performances.gigName")}
          required
          value={name}
          onChangeText={setName}
          placeholder={t("performances.namePlaceholder")}
          error={errors.name}
        />

        <DateField
          label={t("performances.date")}
          value={date || null}
          onChange={(iso) => {
            setDate(iso)
            // A range can never end before it starts.
            if (endDate && endDate < iso) setEndDate(iso)
          }}
          error={errors.date}
        />

        <DateField
          label={t("performances.endDate")}
          value={endDate}
          onChange={(iso) => setEndDate(iso)}
          error={errors.endDate}
          minimumDate={date ? new Date(`${date}T12:00:00`) : undefined}
        />

        <View style={styles.timeRow}>
          <TimeField
            label={t("performances.start")}
            value={startTime || null}
            onChange={(time) => setStartTime(time)}
            placeholder="20:00"
            error={errors.startTime}
            containerStyle={styles.flex}
          />
          <TimeField
            label={t("performances.end")}
            value={endTime || null}
            onChange={(time) => setEndTime(time)}
            placeholder="23:00"
            error={errors.endTime}
            containerStyle={styles.flex}
          />
        </View>

        <View style={styles.field}>
          <AppText variant="caption" tone="muted">
            {t("performances.status")}
          </AppText>
          <View style={styles.wrap}>
            {STATUSES.map((entry) => (
              <Chip
                key={entry}
                label={t(`performances.${entry}`)}
                tone="primary"
                selected={status === entry}
                onPress={() => setStatus(entry)}
              />
            ))}
          </View>
        </View>

        <Input
          label={t("performances.notes")}
          value={notes}
          onChangeText={setNotes}
          placeholder={t("performances.notesPlaceholder")}
          multiline
        />
      </Card>

      <Card style={styles.card}>
        <AppText variant="label" tone="faint">
          {t("performances.venue")}
        </AppText>
        <Input
          label={t("performances.venueName")}
          value={venueName}
          onChangeText={setVenueName}
          placeholder={t("performances.venuePlaceholder")}
          icon={<MapPinIcon size={15} color={Theme.colors.textFaint} />}
        />
        <Input
          label={t("performances.address")}
          value={venueAddress}
          onChangeText={setVenueAddress}
          placeholder={t("performances.addressPlaceholder")}
        />
        <Input
          label={t("performances.venueNotes")}
          value={venueNotes}
          onChangeText={setVenueNotes}
          placeholder={t("performances.venueNotesPlaceholder")}
          multiline
        />
      </Card>

      <Card style={styles.card}>
        <AppText variant="label" tone="faint">
          {t("performances.setlist")}
        </AppText>
        <Button
          label={setlist ? setlist.name : t("performances.attachSetlist")}
          variant={setlist ? "secondary" : "ghost"}
          onPress={() => setSetlistPicker(true)}
          iconRight={setlist ? <AppText variant="body" tone="muted">{t("common.change")}</AppText> : undefined}
        />
        {setlist ? (
          <AppText variant="caption" tone="faint">
            {t("organizations.songsCount", { count: setlist.songs.length })} ·{" "}
            {setlist.estimatedDurationSec > 0 ? t("performances.timedEstimate") : t("performances.noEstimate")}
          </AppText>
        ) : null}
      </Card>

      <View style={styles.actions}>
        <Button label={t("common.cancel")} variant="ghost" onPress={() => router.back()} style={styles.action} />
        <Button
          label={performance ? t("performances.saveChanges") : t("performances.addShow")}
          loading={saving}
          onPress={() => void save()}
          style={styles.action}
        />
      </View>

      <DiscardChangesDialog
        visible={leaveGuard.confirmVisible}
        what={t("performances.discardWhat")}
        onKeepEditing={leaveGuard.keepEditing}
        onDiscard={leaveGuard.discardAndLeave}
      />

      <Dialog
        visible={setlistPicker}
        onClose={() => setSetlistPicker(false)}
        title={t("performances.attachSetlist")}
        hideActions
      >
        <View style={{ gap: 6 }}>
          <Chip
            label={t("performances.noSetlist")}
            selected={setlistId === null}
            onPress={() => {
              setSetlistId(null)
              setSetlistPicker(false)
            }}
          />
          {setlists.map((entry) => (
            <Chip
              key={entry.id}
              label={entry.name}
              tone="primary"
              selected={setlistId === entry.id}
              onPress={() => {
                setSetlistId(entry.id)
                setSetlistPicker(false)
              }}
            />
          ))}
          {setlists.length === 0 ? (
            <AppText variant="caption" tone="faint">
              {t("performances.noSetlistsAvailable")}
            </AppText>
          ) : null}
        </View>
      </Dialog>
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.m },
    timeRow: { flexDirection: "row", gap: Theme.spacing.s },
    field: { gap: 6 },
    flex: { flex: 1 },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    actions: { flexDirection: "row", gap: Theme.spacing.m },
    action: { flex: 1 },
  })

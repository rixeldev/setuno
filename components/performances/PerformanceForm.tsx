import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card, Chip } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { DateField } from "@/components/ui/DateField"
import { PageHeader } from "@/components/ui/PageHeader"
import { Dialog } from "@/components/ui/Dialog"
import { useToast } from "@/components/ui/Toast"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { ClockIcon, MapPinIcon } from "@/components/ui/Icons"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { createPerformance, updatePerformance } from "@/services/performances"
import { toFriendlyError } from "@/services/errors"
import { ISO_DATE_PATTERN, validateRequired, validateTime } from "@/libs/validation"
import { PERFORMANCE_STATUS_LABELS } from "@/interfaces"
import type { Performance, PerformanceInput, PerformanceStatus } from "@/interfaces"

interface PerformanceFormProps {
  /** Present when editing an existing show. */
  performance?: Performance | null
  onSaved?: (performanceId: string) => void
}

const STATUSES: PerformanceStatus[] = ["scheduled", "completed", "cancelled"]

/**
 * Performance (gig) form (docs §22): date, times, venue, notes, optional setlist
 * and status.
 */
export function PerformanceForm({ performance, onSaved }: PerformanceFormProps) {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { profile } = useAuth()
  const { organizationId } = useOrganization()
  const { setlists } = useOrgData()

  const [name, setName] = useState(performance?.name ?? "")
  const [date, setDate] = useState(performance?.date ?? "")
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

  const setlist = setlists.find((entry) => entry.id === setlistId) ?? null

  const save = async (): Promise<void> => {
    const next: Record<string, string> = {}
    const nameError = validateRequired(name, "What is the show called?")
    if (nameError) next.name = nameError
    if (!ISO_DATE_PATTERN.test(date.trim())) next.date = "Pick the date of the show."
    const startError = validateTime(startTime.trim(), "Start time")
    if (startError) next.startTime = startError
    const endError = validateTime(endTime.trim(), "End time")
    if (endError) next.endTime = endError
    if (startError === null && endError === null && startTime > endTime) {
      next.endTime = "The end time is before the start time."
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const input: PerformanceInput = {
      name: name.trim(),
      date: date.trim(),
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
        toast.showSuccess(`"${input.name}" was updated.`)
        onSaved?.(performance.id)
      } else {
        const id = await createPerformance(organizationId ?? "", input, setlist?.name ?? null, author)
        toast.showSuccess(`"${input.name}" was added to the calendar.`)
        onSaved?.(id)
      }
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't save that show."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.host}>
      <PageHeader
        title={performance ? "Edit show" : "New show"}
        subtitle="Gigs, rehearsals and anything on stage"
        back
        elevated
      />

      <ScreenContainer scroll style={styles.body}>
        <Card style={styles.card}>
          <Input
            label="Show name"
            required
            value={name}
            onChangeText={setName}
            placeholder="The Blue Room — Friday"
            error={errors.name}
          />

          <DateField
            label="Date"
            value={date || null}
            onChange={(iso) => setDate(iso)}
            error={errors.date}
          />

          <View style={styles.timeRow}>
            <Input
              label="Start"
              value={startTime}
              onChangeText={setStartTime}
              placeholder="20:00"
              keyboardType="numbers-and-punctuation"
              error={errors.startTime}
              containerStyle={styles.flex}
              icon={<ClockIcon size={15} color={Theme.colors.textFaint} />}
            />
            <Input
              label="End"
              value={endTime}
              onChangeText={setEndTime}
              placeholder="23:00"
              keyboardType="numbers-and-punctuation"
              error={errors.endTime}
              containerStyle={styles.flex}
            />
          </View>

          <View style={styles.field}>
            <AppText variant="caption" tone="muted">
              Status
            </AppText>
            <View style={styles.wrap}>
              {STATUSES.map((entry) => (
                <Chip
                  key={entry}
                  label={PERFORMANCE_STATUS_LABELS[entry]}
                  tone="primary"
                  selected={status === entry}
                  onPress={() => setStatus(entry)}
                />
              ))}
            </View>
          </View>

          <Input
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Load-in at 18:00, two sets of 45 minutes"
            multiline
          />
        </Card>

        <Card style={styles.card}>
          <AppText variant="label" tone="faint">
            Venue
          </AppText>
          <Input
            label="Venue name"
            value={venueName}
            onChangeText={setVenueName}
            placeholder="The Blue Room"
            icon={<MapPinIcon size={15} color={Theme.colors.textFaint} />}
          />
          <Input
            label="Address"
            value={venueAddress}
            onChangeText={setVenueAddress}
            placeholder="14 Riverside Lane"
          />
          <Input
            label="Venue notes"
            value={venueNotes}
            onChangeText={setVenueNotes}
            placeholder="Load in through the side door"
            multiline
          />
        </Card>

        <Card style={styles.card}>
          <AppText variant="label" tone="faint">
            Setlist
          </AppText>
          <Button
            label={setlist ? setlist.name : "Attach a setlist"}
            variant={setlist ? "secondary" : "ghost"}
            onPress={() => setSetlistPicker(true)}
            iconRight={setlist ? <AppText variant="body" tone="muted">Change</AppText> : undefined}
          />
          {setlist ? (
            <AppText variant="caption" tone="faint">
              {setlist.songs.length} songs · {setlist.estimatedDurationSec > 0 ? "timed estimate saved" : "no estimate yet"}
            </AppText>
          ) : null}
        </Card>

        <View style={styles.actions}>
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} style={styles.action} />
          <Button
            label={performance ? "Save changes" : "Add show"}
            loading={saving}
            onPress={() => void save()}
            style={styles.action}
          />
        </View>
      </ScreenContainer>

      <Dialog visible={setlistPicker} onClose={() => setSetlistPicker(false)} title="Attach a setlist" hideActions>
        <View style={{ gap: 6 }}>
          <Chip
            label="No setlist"
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
              You have no setlists yet. You can still add the show and attach one later.
            </AppText>
          ) : null}
        </View>
      </Dialog>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1, backgroundColor: Theme.colors.background },
    body: { paddingTop: Theme.spacing.l },
    card: { gap: Theme.spacing.m },
    timeRow: { flexDirection: "row", gap: Theme.spacing.s },
    field: { gap: 6 },
    flex: { flex: 1 },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    actions: { flexDirection: "row", gap: Theme.spacing.m },
    action: { flex: 1 },
  })
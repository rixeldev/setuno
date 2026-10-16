import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button, IconButton } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { DateField } from "@/components/ui/DateField"
import { TimeField } from "@/components/ui/TimeField"
import { useToast } from "@/components/ui/Toast"
import { ModalScreen } from "@/components/app/ModalScreen"
import { DiscardChangesDialog } from "@/components/app/DiscardChangesDialog"
import { PlusIcon, TrashIcon } from "@/components/ui/Icons"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"
import { createPoll } from "@/services/datePolls"
import { toFriendlyError } from "@/services/errors"
import { ISO_DATE_PATTERN } from "@/libs/validation"
import { POLL_OPTION_MAX } from "@/libs/datePolls"
import type { DatePollOption } from "@/interfaces"
import { useOrganization } from "@/hooks/useOrganization"

/** One candidate row while editing; `id` is generated once and survives edits. */
interface PollRow {
  id: string
  date: string
  time: string
  note: string
}

const newId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const emptyRow = (): PollRow => ({ id: newId(), date: "", time: "", note: "" })

/** Stable snapshot used to detect unsaved changes. */
const serializeForm = (title: string, rows: PollRow[]): string =>
  JSON.stringify({ title, rows: rows.map((row) => ({ ...row, id: "" })) })

/**
 * Poll form (roadmap #48): what the poll is for plus its candidate dates.
 * Any member may propose dates — the rules pin that — so there is no admin
 * gate here. Presented as a modal on the new route.
 */
export function PollForm() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const { organizationId } = useOrganization()

  const [title, setTitle] = useState("")
  const [rows, setRows] = useState<PollRow[]>([emptyRow(), emptyRow()])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [baseline, setBaseline] = useState(() => serializeForm("", [emptyRow(), emptyRow()]))

  const hasUnsavedChanges = serializeForm(title, rows) !== baseline && !saving
  const leaveGuard = useUnsavedChanges(hasUnsavedChanges)

  const setRow = (id: string, patch: Partial<PollRow>): void => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    )
    setErrors((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  const addRow = (): void => setRows((current) => [...current, emptyRow()])
  const removeRow = (id: string): void =>
    setRows((current) => current.filter((row) => row.id !== id))

  const save = async (): Promise<void> => {
    const filled = rows.filter((row) => row.date.trim().length > 0)
    const next: Record<string, string> = {}
    if (title.trim().length === 0) next.title = t("polls.titleRequired")
    if (filled.length < 2) next.form = t("polls.tooFewDates")
    const seen = new Set<string>()
    for (const row of filled) {
      const date = row.date.trim()
      if (!ISO_DATE_PATTERN.test(date)) {
        next[row.id] = t("polls.dateRequired")
      } else if (seen.has(date)) {
        next[row.id] = t("polls.duplicateDate")
      }
      seen.add(date)
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const options: DatePollOption[] = filled.map((row) => ({
      id: row.id,
      date: row.date.trim(),
      time: row.time.trim(),
      note: row.note.trim(),
    }))

    setSaving(true)
    try {
      await createPoll(organizationId ?? "", { title: title.trim(), options })
      toast.showSuccess(t("polls.pollCreated", { title: title.trim() }))
      setBaseline(serializeForm(title, rows))
      router.back()
    } catch (error) {
      toast.showError(toFriendlyError(error, t("polls.couldNotSave")))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalScreen title={t("polls.newPoll")} subtitle={t("polls.newPollSubtitle")}>
      <Card style={styles.card}>
        <Input
          label={t("polls.titleLabel")}
          placeholder={t("polls.titlePlaceholder")}
          value={title}
          onChangeText={setTitle}
          error={errors.title ?? null}
          maxLength={120}
        />
      </Card>

      <Card style={styles.card}>
        <AppText variant="label" tone="faint">
          {t("polls.datesLabel")}
        </AppText>

        {rows.map((row, index) => (
          <View key={row.id} style={styles.row}>
            <View style={styles.rowFields}>
              <DateField
                label={`${t("polls.dateOption")} ${index + 1}`}
                value={row.date.length > 0 ? row.date : null}
                onChange={(iso) => setRow(row.id, { date: iso })}
                error={errors[row.id] ?? null}
              />
              <TimeField
                label={t("polls.timeOptional")}
                value={row.time.length > 0 ? row.time : null}
                onChange={(time) => setRow(row.id, { time })}
              />
            </View>
            <IconButton
              icon={<TrashIcon size={16} color={Theme.colors.textMuted} />}
              onPress={() => removeRow(row.id)}
              label={t("polls.removeDate")}
            />
          </View>
        ))}

        {errors.form ? (
          <AppText variant="caption" tone="danger">
            {errors.form}
          </AppText>
        ) : null}

        {rows.length < POLL_OPTION_MAX ? (
          <Button
            label={t("polls.addDate")}
            variant="ghost"
            size="sm"
            icon={<PlusIcon size={18} color={Theme.colors.text} />}
            onPress={addRow}
          />
        ) : (
          <AppText variant="caption" tone="faint">
            {t("polls.tooManyDates")}
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
          label={t("polls.createPoll")}
          loading={saving}
          onPress={() => void save()}
          style={styles.action}
        />
      </View>

      <DiscardChangesDialog
        visible={leaveGuard.confirmVisible}
        what={t("polls.discardWhat")}
        onKeepEditing={leaveGuard.keepEditing}
        onDiscard={leaveGuard.discardAndLeave}
      />
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.m },
    row: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: Theme.spacing.s,
    },
    rowFields: { flex: 1, gap: Theme.spacing.s },
    actions: { flexDirection: "row", gap: Theme.spacing.s },
    action: { flex: 1 },
  })

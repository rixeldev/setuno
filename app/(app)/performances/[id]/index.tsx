import React, { useMemo, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState, Skeleton } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import {
  CheckCircleIcon,
  ClockIcon,
  CloseIcon,
  EditIcon,
  MapPinIcon,
  MusicIcon,
  TrashIcon,
} from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { deletePerformance, updatePerformance } from "@/services/performances"
import { toFriendlyError } from "@/services/errors"
import type { RelativeDayLabels } from "@/libs/format"
import { formatDateRange, formatDurationLong, formatRelativeDay, formatTime } from "@/libs/format"
import { parseIsoDate } from "@/libs/validation"
import type { PerformanceStatus } from "@/interfaces"

const STATUS_TONES = {
  completed: "success",
  cancelled: "danger",
  scheduled: "primary",
} as const

/** Show detail (docs §22): details, attached setlist and admin actions. */
export default function PerformanceDetail() {
  const { t, i18n } = useTranslation()
  const dayLabels: RelativeDayLabels = {
    today: t("common.today"),
    tomorrow: t("common.tomorrow"),
    yesterday: t("common.yesterday"),
  }
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const params = useLocalSearchParams<{ id?: string }>()
  const performanceId = params.id ?? null

  const { profile } = useAuth()
  const { organizationId, isAdmin } = useOrganization()
  const { performances, setlists, loading } = useOrgData()

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const performance = useMemo(
    () => performances.find((entry) => entry.id === performanceId) ?? null,
    [performances, performanceId],
  )
  const setlist = useMemo(
    () =>
      performance?.setlistId
        ? (setlists.find((entry) => entry.id === performance.setlistId) ?? null)
        : null,
    [performance, setlists],
  )
  const actor = { id: profile?.uid ?? "", name: profile?.displayName || "An admin" }

  const setStatus = async (status: PerformanceStatus): Promise<void> => {
    if (!performance) return
    setBusy(true)
    try {
      await updatePerformance(
        organizationId ?? "",
        performance.id,
        {
          name: performance.name,
          date: performance.date,
          endDate: performance.endDate,
          startTime: performance.startTime,
          endTime: performance.endTime,
          venue: performance.venue,
          notes: performance.notes,
          setlistId: performance.setlistId,
          status,
        },
        performance.setlistName,
        actor,
      )
      toast.showSuccess(t("performances.markedAs", { status: t(`performances.${status}`).toLowerCase() }))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("performances.couldNotUpdate")))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    if (!performance) return
    setBusy(true)
    try {
      await deletePerformance(organizationId ?? "", performance.id, actor)
      setConfirmDelete(false)
      toast.showSuccess(t("performances.performanceDeleted", { name: performance.name }))
      router.replace("/performances")
    } catch (error) {
      toast.showError(toFriendlyError(error, t("performances.couldNotDelete")))
    } finally {
      setBusy(false)
    }
  }

  if (!performanceId) {
    return (
      <ScreenContainer back title={t("performances.gig")}>
        <EmptyState
          title={t("performances.performanceNotFound")}
          message={t("performances.pickOne")}
        />
      </ScreenContainer>
    )
  }

  if (!performance) {
    return (
      <ScreenContainer back title={t("performances.gig")}>
        {loading ? <Skeleton height={200} /> : null}
        {!loading ? (
          <EmptyState
            title={t("performances.performanceNotFound")}
            message={t("performances.performanceNotFoundDescription")}
            actionLabel={t("performances.backToPerformances")}
            onAction={() => router.replace("/performances")}
          />
        ) : null}
      </ScreenContainer>
    )
  }

  const date = parseIsoDate(performance.date)
  const safeDate = date ?? new Date()
  const stampDay = `${safeDate.getDate()}`
  const stampMonth = new Intl.DateTimeFormat(i18n.language, { month: "short" }).format(safeDate)
  const dateLabel = formatDateRange(performance.date, performance.endDate, i18n.language)
  const relativeDay = date ? formatRelativeDay(date, dayLabels) : ""
  const timeRange = [performance.startTime, performance.endTime]
    .filter((value) => value.length > 0)
    .map((value) => formatTime(value))
    .join(" – ")
  const hasVenue = Boolean(performance.venue.name || performance.venue.address || performance.venue.notes)
  const hasNotes = performance.notes.trim().length > 0

  return (
    <ScreenContainer
      back
      title={performance.name}
      subtitle={dateLabel}
      large
      titleLines={2}
      headerRight={
        isAdmin ? (
          <View style={styles.headerActions}>
            <IconButton
              label={t("performances.editPerformance")}
              onPress={() => router.push(`/performances/${performance.id}/edit`)}
              icon={<EditIcon size={18} color={Theme.colors.textMuted} />}
            />
            <IconButton
              label={t("performances.deletePerformance")}
              onPress={() => setConfirmDelete(true)}
              icon={<TrashIcon size={18} color={Theme.colors.danger} />}
            />
          </View>
        ) : null
      }
    >
      {/* Key facts: an editorial date block next to the status, time and place. */}
      <Card style={styles.infoCard}>
        <View style={styles.infoTop}>
          <View style={styles.stamp}>
            <AppText variant="title" tone="primary">
              {stampDay}
            </AppText>
            <AppText variant="caption" tone="faint">
              {stampMonth}
            </AppText>
          </View>

          <View style={styles.infoBody}>
            <Badge
              label={t(`performances.${performance.status}`)}
              tone={STATUS_TONES[performance.status]}
            />
            {relativeDay ? (
              <AppText variant="bodyStrong" numberOfLines={2}>
                {relativeDay}
              </AppText>
            ) : null}
            {timeRange ? (
              <View style={styles.metaRow}>
                <ClockIcon size={13} color={Theme.colors.textFaint} />
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {timeRange}
                </AppText>
              </View>
            ) : null}
            {hasVenue ? (
              <View style={styles.metaRow}>
                <MapPinIcon size={13} color={Theme.colors.textFaint} />
                <View style={styles.flex}>
                  <AppText variant="caption" tone="muted" numberOfLines={2}>
                    {[performance.venue.name, performance.venue.address].filter(Boolean).join(" · ") ||
                      t("performances.venueNotSet")}
                  </AppText>
                  {performance.venue.notes ? (
                    <AppText variant="caption" tone="faint" numberOfLines={2}>
                      {performance.venue.notes}
                    </AppText>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Card>

      {hasNotes ? (
        <View style={styles.notes}>
          <AppText variant="body" tone="muted">
            {performance.notes}
          </AppText>
        </View>
      ) : null}

      <Card style={styles.setlistCard}>
        <View style={styles.sectionHeader}>
          <AppText variant="label" tone="faint">
            {t("performances.setlist")}
          </AppText>
          {setlist ? (
            <Button
              label={t("performances.openSetlist")}
              size="sm"
              variant="ghost"
              onPress={() => router.push(`/setlists/${setlist.id}`)}
            />
          ) : null}
        </View>

        {setlist ? (
          <>
            <View style={styles.metaRow}>
              <MusicIcon size={14} color={Theme.colors.primary} />
              <AppText variant="subheading" style={styles.flex} numberOfLines={2}>
                {setlist.name}
              </AppText>
            </View>
            <AppText variant="caption" tone="faint">
              {t("setlists.songsCount", {
                count: setlist.songs.length,
                duration: formatDurationLong(setlist.estimatedDurationSec),
              })}
            </AppText>
            <View style={styles.songs}>
              {setlist.songs.slice(0, 8).map((entry, index) => (
                <Pressable
                  key={`${entry.songId}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={entry.title}
                  onPress={() => router.push(`/songs/${entry.songId}`)}
                  style={({ pressed }) => [styles.songRow, pressed && styles.pressed]}
                >
                  <AppText variant="caption" tone="faint" style={styles.order}>
                    {index + 1}
                  </AppText>
                  <AppText variant="body" numberOfLines={1} style={styles.flex}>
                    {entry.title}
                  </AppText>
                  {entry.key ? <Badge label={entry.key} tone="accent" /> : null}
                </Pressable>
              ))}
              {setlist.songs.length > 8 ? (
                <AppText variant="caption" tone="faint">
                  {t("performances.moreSongs", { count: setlist.songs.length - 8 })}
                </AppText>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.emptySetlist}>
            <AppText variant="caption" tone="faint">
              {t("performances.noSetlistAttached")}
            </AppText>
            {isAdmin ? (
              <Button
                label={t("performances.attachSetlist")}
                variant="secondary"
                size="sm"
                onPress={() => router.push(`/performances/${performance.id}/edit`)}
              />
            ) : null}
          </View>
        )}
      </Card>

      {performance.status === "cancelled" ? (
        <AppText variant="caption" tone="danger">
          {t("performances.cancelledChip")}
        </AppText>
      ) : null}

      {isAdmin && performance.status !== "completed" ? (
        // Stacked full-width actions: they can never overflow the viewport.
        <View style={styles.actions}>
          {performance.status === "scheduled" ? (
            <Button
              label={t("performances.markCompleted")}
              full
              disabled={busy}
              icon={<CheckCircleIcon size={16} color={Theme.colors.onPrimary} />}
              onPress={() => void setStatus("completed")}
            />
          ) : null}
          {performance.status === "scheduled" ? (
            <Button
              label={t("performances.cancelShow")}
              variant="secondary"
              full
              disabled={busy}
              icon={<CloseIcon size={16} color={Theme.colors.danger} />}
              onPress={() => void setStatus("cancelled")}
            />
          ) : null}
          {performance.status === "cancelled" ? (
            <Button
              label={t("performances.markScheduled")}
              variant="secondary"
              full
              disabled={busy}
              onPress={() => void setStatus("scheduled")}
            />
          ) : null}
        </View>
      ) : null}

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("performances.deletePerformanceConfirm", { name: performance.name })}
        description={t("performances.deletePerformanceDescription")}
        confirmLabel={t("performances.deletePerformance")}
        tone="danger"
        confirmLoading={busy}
        onConfirm={() => void remove()}
      />
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    headerActions: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.xs },
    infoCard: { gap: Theme.spacing.m },
    infoTop: { flexDirection: "row", alignItems: "stretch", gap: Theme.spacing.l },
    stamp: {
      minWidth: 48,
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
      paddingRight: Theme.spacing.l,
      borderRightWidth: 1,
      borderRightColor: Theme.colors.borderSoft,
    },
    infoBody: { flex: 1, minWidth: 0, gap: 6, justifyContent: "center" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    flex: { flex: 1, minWidth: 0 },
    notes: {
      borderLeftWidth: 2,
      borderLeftColor: Theme.colors.primary,
      paddingLeft: Theme.spacing.m,
    },
    setlistCard: { gap: Theme.spacing.m },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.s,
    },
    songs: { gap: 2 },
    songRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.s,
    },
    order: { width: 16, textAlign: "right" },
    pressed: { opacity: 0.7 },
    emptySetlist: { gap: Theme.spacing.m, alignItems: "flex-start" },
    actions: { gap: Theme.spacing.s, width: "100%", maxWidth: 420 },
  })

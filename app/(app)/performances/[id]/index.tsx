import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card, Chip } from "@/components/ui/Card"
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
import {
  formatDateRange,
  formatDurationLong,
  formatRelativeDay,
  formatTime,
} from "@/libs/format"
import { parseIsoDate } from "@/libs/validation"
import type { PerformanceStatus } from "@/interfaces"

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
              variant="secondary"
              onPress={() => router.push(`/performances/${performance.id}/edit`)}
              icon={<EditIcon size={18} color={Theme.colors.text} />}
            />
            <IconButton
              label={t("performances.deletePerformance")}
              variant="secondary"
              onPress={() => setConfirmDelete(true)}
              icon={<TrashIcon size={18} color={Theme.colors.danger} />}
            />
          </View>
        ) : null
      }
    >
      {/* Key facts: date, status, time and place in one tidy block. */}
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

          <View style={styles.flex}>
            <View style={styles.badges}>
              <Badge
                label={t(`performances.${performance.status}`)}
                tone={
                  performance.status === "completed"
                    ? "success"
                    : performance.status === "cancelled"
                      ? "danger"
                      : "primary"
                }
              />
              {timeRange ? <Badge label={timeRange} tone="default" /> : null}
            </View>
            <AppText variant="bodyStrong" numberOfLines={2}>
              {dateLabel}
            </AppText>
            {relativeDay ? (
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {relativeDay}
              </AppText>
            ) : null}
          </View>
        </View>

        {timeRange ? (
          <View style={styles.detailRow}>
            <ClockIcon size={15} color={Theme.colors.textFaint} />
            <AppText variant="body" tone="muted" style={styles.flex}>
              {timeRange}
            </AppText>
          </View>
        ) : null}

        {hasVenue ? (
          <View style={styles.detailRow}>
            <MapPinIcon size={15} color={Theme.colors.textFaint} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={2}>
                {performance.venue.name || t("performances.venueNotSet")}
              </AppText>
              {performance.venue.address ? (
                <AppText variant="caption" tone="muted" numberOfLines={2}>
                  {performance.venue.address}
                </AppText>
              ) : null}
              {performance.venue.notes ? (
                <AppText variant="caption" tone="faint" numberOfLines={2}>
                  {performance.venue.notes}
                </AppText>
              ) : null}
            </View>
          </View>
        ) : null}
      </Card>

      {hasNotes ? (
        <Card style={{ gap: 6 }}>
          <AppText variant="label" tone="faint">
            {t("performances.notes")}
          </AppText>
          <AppText variant="body" tone="muted">
            {performance.notes}
          </AppText>
        </Card>
      ) : null}

      <Card style={{ gap: Theme.spacing.m }}>
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
            <View style={styles.detailRow}>
              <MusicIcon size={15} color={Theme.colors.primary} />
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
                <View key={`${entry.songId}-${index}`} style={styles.songRow}>
                  <AppText variant="caption" tone="faint" style={styles.order}>
                    {index + 1}
                  </AppText>
                  <AppText variant="body" numberOfLines={1} style={styles.flex} onPress={() => router.push(`/songs/${entry.songId}`)}>
                    {entry.title}
                  </AppText>
                  {entry.key ? <Badge label={entry.key} tone="accent" /> : null}
                </View>
              ))}
              {setlist.songs.length > 8 ? (
                <AppText variant="caption" tone="faint">
                  {t("performances.moreSongs", { count: setlist.songs.length - 8 })}
                </AppText>
              ) : null}
            </View>
          </>
        ) : (
          <View style={{ gap: Theme.spacing.m }}>
            <AppText variant="caption" tone="faint">
              {t("performances.noSetlistAttached")}
            </AppText>
            {isAdmin ? (
              <Button
                label={t("performances.attachSetlist")}
                variant="secondary"
                onPress={() => router.push(`/performances/${performance.id}/edit`)}
              />
            ) : null}
          </View>
        )}
      </Card>

      {isAdmin && performance.status !== "completed" ? (
        <View style={styles.statusActions}>
          <Button
            label={t("performances.markCompleted")}
            variant="secondary"
            disabled={busy}
            icon={<CheckCircleIcon size={16} color={Theme.colors.text} />}
            onPress={() => void setStatus("completed")}
            style={styles.action}
          />
          {performance.status !== "cancelled" ? (
            <Button
              label={t("performances.cancelShow")}
              variant="danger"
              disabled={busy}
              icon={<CloseIcon size={16} color={Theme.colors.onPrimary} />}
              onPress={() => void setStatus("cancelled")}
              style={styles.action}
            />
          ) : null}
        </View>
      ) : null}

      {isAdmin && performance.status === "cancelled" ? (
        <View style={styles.cancelledRow}>
          <Chip label={t("performances.cancelledChip")} tone="danger" />
          <Button
            label={t("performances.markScheduled")}
            variant="ghost"
            disabled={busy}
            onPress={() => void setStatus("scheduled")}
          />
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
    headerActions: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    infoCard: { gap: Theme.spacing.m },
    infoTop: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    stamp: {
      minWidth: 56,
      paddingVertical: Theme.spacing.s,
      paddingHorizontal: Theme.spacing.s,
      borderRadius: Theme.radii.lg,
      backgroundColor: Theme.colors.primarySoft,
      alignItems: "center",
      gap: 1,
    },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 2 },
    detailRow: { flexDirection: "row", alignItems: "flex-start", gap: Theme.spacing.s },
    flex: { flex: 1, minWidth: 0 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.s,
    },
    songs: { gap: 6 },
    songRow: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s, paddingVertical: 4 },
    order: {
      width: 22,
      textAlign: "center",
      paddingVertical: 2,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.surfaceHigh,
      overflow: "hidden",
    },
    statusActions: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    cancelledRow: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    action: { flexGrow: 1 },
  })

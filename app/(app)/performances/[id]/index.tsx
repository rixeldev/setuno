import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

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
import { formatDate, formatDurationLong, formatRelativeDay, formatTime, pluralize } from "@/libs/format"
import { parseIsoDate } from "@/libs/validation"
import { PERFORMANCE_STATUS_LABELS } from "@/interfaces"
import type { PerformanceStatus } from "@/interfaces"

/** Show detail (docs §22): details, attached setlist and admin actions. */
export default function PerformanceDetail() {
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
    () => (performance?.setlistId ? (setlists.find((entry) => entry.id === performance.setlistId) ?? null) : null),
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
      toast.showSuccess(`Marked as ${PERFORMANCE_STATUS_LABELS[status].toLowerCase()}.`)
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't update that show."))
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
      toast.showSuccess(`"${performance.name}" was deleted.`)
      router.replace("/performances")
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't delete that show."))
    } finally {
      setBusy(false)
    }
  }

  if (!performanceId) {
    return (
      <ScreenContainer back title="Show">
        <EmptyState title="Show not found" message="Pick one from the shows screen." />
      </ScreenContainer>
    )
  }

  if (!performance) {
    return (
      <ScreenContainer back title="Show">
        {loading ? <Skeleton height={200} /> : null}
        {!loading ? (
          <EmptyState
            title="Show not found"
            message="It may have been deleted, or you may not have access to this band."
            actionLabel="Back to shows"
            onAction={() => router.replace("/performances")}
          />
        ) : null}
      </ScreenContainer>
    )
  }

  const date = parseIsoDate(performance.date)
  const timeRange = [performance.startTime, performance.endTime]
    .filter((value) => value.length > 0)
    .map((value) => formatTime(value))
    .join(" – ")

  return (
    <ScreenContainer
      back
      title={performance.name}
      subtitle={formatRelativeDay(date)}
      large
      headerRight={
        isAdmin ? (
          <View style={styles.headerActions}>
            <IconButton
              label="Edit show"
              onPress={() => router.push(`/performances/${performance.id}/edit`)}
              icon={<EditIcon size={18} color={Theme.colors.textMuted} />}
            />
            <IconButton
              label="Delete show"
              variant="danger"
              onPress={() => setConfirmDelete(true)}
              icon={<TrashIcon size={18} color={Theme.colors.danger} />}
            />
          </View>
        ) : null
      }
    >
      <Card style={{ gap: Theme.spacing.m }}>
        <View style={styles.badges}>
          <Badge
            label={PERFORMANCE_STATUS_LABELS[performance.status]}
            tone={
              performance.status === "completed"
                ? "success"
                : performance.status === "cancelled"
                  ? "danger"
                  : "primary"
            }
          />
          {timeRange ? <Badge label={timeRange} /> : null}
        </View>

        <View style={styles.detailRow}>
          <ClockIcon size={15} color={Theme.colors.textFaint} />
          <AppText variant="body" tone="muted" style={styles.flex}>
            {formatDate(date)}
            {timeRange ? ` · ${timeRange}` : ""}
          </AppText>
        </View>

        {performance.venue.name || performance.venue.address ? (
          <View style={styles.detailRow}>
            <MapPinIcon size={15} color={Theme.colors.textFaint} />
            <View style={styles.flex}>
              <AppText variant="body">{performance.venue.name || "Venue not set"}</AppText>
              {performance.venue.address ? (
                <AppText variant="caption" tone="muted">
                  {performance.venue.address}
                </AppText>
              ) : null}
              {performance.venue.notes ? (
                <AppText variant="caption" tone="faint">
                  {performance.venue.notes}
                </AppText>
              ) : null}
            </View>
          </View>
        ) : null}

        {performance.notes.trim().length > 0 ? (
          <AppText variant="body" tone="muted">
            {performance.notes}
          </AppText>
        ) : null}
      </Card>

      <Card style={{ gap: Theme.spacing.m }}>
        <AppText variant="label" tone="faint">
          Setlist
        </AppText>
        {setlist ? (
          <>
            <View style={styles.detailRow}>
              <MusicIcon size={15} color={Theme.colors.primary} />
              <AppText variant="subheading" style={styles.flex} onPress={() => router.push(`/setlists/${setlist.id}`)}>
                {setlist.name}
              </AppText>
            </View>
            <AppText variant="caption" tone="faint">
              {pluralize(setlist.songs.length, "song")} · {formatDurationLong(setlist.estimatedDurationSec)}
            </AppText>
            <View style={styles.songs}>
              {setlist.songs.slice(0, 12).map((entry, index) => (
                <View key={`${entry.songId}-${index}`} style={styles.songRow}>
                  <AppText variant="caption" tone="faint" style={styles.order}>
                    {index + 1}
                  </AppText>
                  <AppText
                    variant="body"
                    numberOfLines={1}
                    style={styles.flex}
                    onPress={() => router.push(`/songs/${entry.songId}`)}
                  >
                    {entry.title}
                  </AppText>
                  {entry.key ? <Badge label={entry.key} tone="accent" /> : null}
                </View>
              ))}
              {setlist.songs.length > 12 ? (
                <AppText variant="caption" tone="faint">
                  + {setlist.songs.length - 12} more
                </AppText>
              ) : null}
            </View>
            <Button
              label="Open the setlist"
              variant="secondary"
              onPress={() => router.push(`/setlists/${setlist.id}`)}
            />
          </>
        ) : (
          <View style={{ gap: Theme.spacing.m }}>
            <AppText variant="caption" tone="faint">
              No setlist attached yet.
            </AppText>
            {isAdmin ? (
              <Button
                label="Attach a setlist"
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
            label="Mark completed"
            variant="secondary"
            disabled={busy}
            icon={<CheckCircleIcon size={16} color={Theme.colors.text} />}
            onPress={() => void setStatus("completed")}
            style={styles.action}
          />
          {performance.status !== "cancelled" ? (
            <Button
              label="Cancel show"
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
        <View style={styles.statusActions}>
          <Chip label="This show was cancelled" tone="danger" />
          <Button
            label="Mark as scheduled again"
            variant="ghost"
            disabled={busy}
            onPress={() => void setStatus("scheduled")}
          />
        </View>
      ) : null}

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete "${performance.name}"?`}
        description="The show disappears from the band calendar. Any setlist stays untouched."
        confirmLabel="Delete show"
        tone="danger"
        confirmLoading={busy}
        onConfirm={() => void remove()}
      />
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    detailRow: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    flex: { flex: 1, minWidth: 0 },
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
    action: { flexGrow: 1 },
  })
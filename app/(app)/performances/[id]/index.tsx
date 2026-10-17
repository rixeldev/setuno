import React, { useMemo, useState } from "react"
import { Pressable, StyleSheet, Switch, View } from "react-native"
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
  CalendarCheckIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  EditIcon,
  ListIcon,
  MapPinIcon,
  MusicIcon,
  ShareIcon,
  TrashIcon,
} from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { useResponsive } from "@/hooks/useResponsive"
import { deletePerformance, setLiveShare, updatePerformance } from "@/services/performances"
import { setShareLive, createShareLink } from "@/services/shares"
import { toFriendlyError } from "@/services/errors"
import { exportPerformancesToIcs } from "@/libs/calendarExport"
import { AttendanceCard } from "@/components/performances/AttendanceCard"
import { EventTasksCard } from "@/components/performances/EventTasksCard"
import { ShareSheet } from "@/components/shares/ShareSheet"
import { useEventTasks } from "@/hooks/useEventTasks"
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
  const { organization, organizationId, isAdmin } = useOrganization()
  const { performances, setlists, members, loading } = useOrgData()
  const { usesSidebar } = useResponsive()
  // Roadmap #47: the tasks subscribe per screen (the RSVP map rides the event
  // document above); tagged by band+event inside the hook, so a stale list can
  // never leak across events.
  const { tasks: eventTasks } = useEventTasks(organizationId, performanceId)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  // Roadmap #57: the public live setlist gets its own busy flag, so minting
  // a link never disables the RSVP/tasks controls below.
  const [togglingLive, setTogglingLive] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const performance = useMemo(
    () => performances.find((entry) => entry.id === performanceId) ?? null,
    [performances, performanceId],
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
          setlists: performance.setlists,
          status,
          type: performance.type,
        },
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

  const exportToCalendar = async (): Promise<void> => {
    if (!performance) return
    setExporting(true)
    try {
      const shared = await exportPerformancesToIcs({
        performances: [performance],
        organizationId: organizationId ?? "",
        calendarName: organization?.name ?? performance.name,
        fileLabel: performance.name,
        dialogTitle: t("calendar.exportEvent"),
      })
      if (shared) toast.showSuccess(t("calendar.exported"))
      else toast.showError(t("calendar.exportUnavailable"))
    } catch (caught) {
      toast.showError(toFriendlyError(caught, t("calendar.couldNotExport")))
    } finally {
      setExporting(false)
    }
  }

  /**
   * The public live setlist (roadmap #57): turning it on mints (or refreshes)
   * the first attached setlist's link — #56's callable reuses the active token
   * in place, so the URL never changes under a fan — and points the event at
   * it; turning it off only detaches the event, so the same URL keeps working
   * as the plain static snapshot it always was. The band flips this at the
   * venue: the reader starts broadcasting positions the moment somebody opens
   * a song of that exact setlist.
   */
  const toggleLive = async (next: boolean): Promise<void> => {
    if (!performance || !organizationId) return
    setTogglingLive(true)
    try {
      if (next) {
        const setlist = performance.setlists[0]
        if (!setlist) return
        const link = await createShareLink({
          kind: "setlist",
          organizationId,
          sourceId: setlist.id,
          expiresInDays: null,
        })
        await setLiveShare(organizationId, performance.id, {
          token: link.token,
          setlistId: setlist.id,
        })
        toast.showSuccess(t("performances.liveSetlistEnabled"))
      } else {
        const current = performance.liveShare
        if (current) {
          // Best effort: the link may already be revoked, and a dead one must
          // not keep the event attached.
          try {
            await setShareLive(current.token, null)
          } catch {
            // Ignored on purpose — the detach below is what turns it off.
          }
        }
        await setLiveShare(organizationId, performance.id, null)
        toast.showSuccess(t("performances.liveSetlistDisabled"))
      }
    } catch (error) {
      toast.showError(toFriendlyError(error, t("performances.liveSetlistFailed")))
    } finally {
      setTogglingLive(false)
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
  const attachedSetlists = performance.setlists
  // Roadmap #57: which setlist the public live link follows (the first one
  // attached), spelled out for the toggle's caption.
  const liveShare = performance.liveShare
  const sharedSetlistName = liveShare
    ? setlists.find((entry) => entry.id === liveShare.setlistId)?.name ||
      attachedSetlists.find((entry) => entry.id === liveShare.setlistId)?.name ||
      ""
    : ""
  const showAdminActions = isAdmin && performance.status !== "completed"
  /** Wide layout: both action groups side by side, each filling its column. */
  const inActionGrid = usesSidebar && showAdminActions

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
            <View style={styles.badges}>
              {performance.type === "rehearsal" ? (
                <Badge label={t("performances.typeRehearsal")} tone="accent" />
              ) : null}
              <Badge
                label={t(`performances.${performance.status}`)}
                tone={STATUS_TONES[performance.status]}
              />
            </View>
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
        <AppText variant="label" tone="faint">
          {t("performances.setlist")}
        </AppText>

        {attachedSetlists.length > 0 ? (
          <View style={styles.songs}>
            {attachedSetlists.map((entry) => {
              const doc = setlists.find((item) => item.id === entry.id)
              return (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  accessibilityLabel={entry.name || t("performances.openSetlist")}
                  onPress={() => router.push(`/setlists/${entry.id}`)}
                  style={({ pressed }) => [styles.setlistRow, pressed && styles.pressed]}
                >
                  <MusicIcon size={15} color={Theme.colors.primary} />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {entry.name}
                    </AppText>
                    {doc ? (
                      <AppText variant="caption" tone="faint" numberOfLines={1}>
                        {t("setlists.songsCount", {
                          count: doc.songs.length,
                          duration: formatDurationLong(doc.estimatedDurationSec),
                        })}
                      </AppText>
                    ) : null}
                  </View>
                  <ChevronRightIcon size={16} color={Theme.colors.textFaint} />
                </Pressable>
              )
            })}
          </View>
        ) : (
          <View style={styles.emptySetlist}>
            <AppText variant="caption" tone="faint">
              {t("performances.noSetlistAttached")}
            </AppText>
            {isAdmin ? (
              <Button
                label={t("performances.attachSetlists")}
                variant="secondary"
                size="sm"
                onPress={() => router.push(`/performances/${performance.id}/edit`)}
              />
            ) : null}
          </View>
        )}
      </Card>

      {/* Roadmap #57: the public live setlist — the band opts in per event,
          and the reader moves the position while walking the shared setlist.
          Only while the night is still on the books: a finished or cancelled
          event has nothing to follow. */}
      {performance.status === "scheduled" && attachedSetlists.length > 0 ? (
        <Card style={styles.liveCard}>
          <View style={styles.liveRow}>
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{t("performances.liveSetlistTitle")}</AppText>
              <AppText variant="caption" tone="muted">
                {liveShare
                  ? t("performances.liveSetlistOn", { name: sharedSetlistName })
                  : t("performances.liveSetlistOff")}
              </AppText>
            </View>
            <Switch
              accessibilityLabel={t("performances.liveSetlistTitle")}
              accessibilityHint={
                liveShare
                  ? t("performances.liveSetlistOn", { name: sharedSetlistName })
                  : t("performances.liveSetlistOff")
              }
              disabled={togglingLive}
              value={Boolean(liveShare)}
              onValueChange={(next) => void toggleLive(next)}
              trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
              ios_backgroundColor={Theme.colors.border}
            />
          </View>
          {liveShare ? (
            <Button
              label={t("performances.liveSetlistLink")}
              variant="secondary"
              size="sm"
              icon={<ShareIcon size={16} color={Theme.colors.text} />}
              onPress={() => setShareOpen(true)}
            />
          ) : null}
        </Card>
      ) : null}

      {/* Roadmap #47: RSVP + "who brings what", hidden for a cancelled event
          — there is nothing to answer and nothing to bring to a night that
          is not happening. */}
      {performance.status !== "cancelled" && profile ? (
        <>
          <AttendanceCard
            organizationId={organizationId ?? ""}
            performanceId={performance.id}
            attendance={performance.attendance}
            members={members}
            currentUid={profile.uid}
          />
          <EventTasksCard
            organizationId={organizationId ?? ""}
            performanceId={performance.id}
            tasks={eventTasks}
            members={members}
            currentUid={profile.uid}
            isAdmin={isAdmin}
          />
        </>
      ) : null}

      {performance.status === "cancelled" ? (
        <AppText variant="caption" tone="danger">
          {t("performances.cancelledChip")}
        </AppText>
      ) : null}

      {/* Anyone can open the post-gig report once a setlist is attached
          (roadmap #45) — the rules' member carve-out lets non-admins mark the
          log too — and anyone can drop the show into their own calendar
          (roadmap #50). On a wide screen (web/desktop) the member and admin
          groups sit side by side as a two-column grid occupying the whole
          content width, each button filling its own column; phones and
          tablets keep the single stacked column, capped at 420. */}
      <View style={inActionGrid ? styles.actionsGrid : styles.actionsWrap}>
        <View style={[styles.actions, inActionGrid ? styles.actionsColumn : null]}>
          {attachedSetlists.length > 0 ? (
            <Button
              label={t("performances.reportAction")}
              variant="secondary"
              full
              icon={<ListIcon size={16} color={Theme.colors.text} />}
              onPress={() => router.push(`/performances/${performance.id}/report`)}
            />
          ) : null}
          <Button
            label={t("calendar.exportEvent")}
            variant="secondary"
            full
            disabled={exporting}
            loading={exporting}
            icon={<CalendarCheckIcon size={16} color={Theme.colors.text} />}
            onPress={() => void exportToCalendar()}
          />
        </View>

        {showAdminActions ? (
          <View style={[styles.actions, inActionGrid ? styles.actionsColumn : null]}>
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
      </View>

      {/* #56's sheet, reused: the very link the live toggle minted — QR, copy
          and system share all keep working, and revoking kills the fan page
          too (the reader's writes then bounce harmlessly). */}
      <ShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        kind="setlist"
        organizationId={organizationId ?? ""}
        sourceId={liveShare?.setlistId ?? attachedSetlists[0]?.id ?? ""}
        title={
          setlists.find((entry) => entry.id === (liveShare?.setlistId ?? attachedSetlists[0]?.id))
            ?.name ||
          attachedSetlists[0]?.name ||
          performance.name
        }
      />

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
    badges: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    flex: { flex: 1, minWidth: 0 },
    notes: {
      borderLeftWidth: 2,
      borderLeftColor: Theme.colors.primary,
      paddingLeft: Theme.spacing.m,
    },
    setlistCard: { gap: Theme.spacing.m },
    songs: { gap: 2 },
    setlistRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.s,
    },
    pressed: { opacity: 0.7 },
    emptySetlist: { gap: Theme.spacing.m, alignItems: "flex-start" },
    // Roadmap #57: the live setlist toggle row.
    liveCard: { gap: Theme.spacing.m },
    liveRow: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    // Mobile/tablet: one stacked column, capped so buttons never stretch.
    actionsWrap: { width: "100%", maxWidth: 420, gap: Theme.spacing.xl },
    // Wide (web/desktop): the member and admin groups sit side by side and
    // fill the whole content width — the owner's two-column layout ask.
    actionsGrid: {
      width: "100%",
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Theme.spacing.l,
    },
    actions: { gap: Theme.spacing.s, width: "100%" },
    actionsColumn: { flex: 1, minWidth: 0 },
  })

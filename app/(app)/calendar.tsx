import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Card, Chip, Section } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { EmptyState, ErrorState } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import { CalendarCheckIcon, CalendarIcon, PlusIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { CalendarMonth } from "@/components/performances/CalendarMonth"
import { CalendarWeek } from "@/components/performances/CalendarWeek"
import { PerformanceListRow } from "@/components/performances/PerformanceCard"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { exportPerformancesToIcs } from "@/libs/calendarExport"
import {
  CALENDAR_STATUSES,
  CALENDAR_VIEWS,
  DEFAULT_STATUSES,
  dayCounts,
  filterByStatus,
  groupByDay,
  shiftWeek,
  upcomingByDay,
  weekDays,
  weekStartIso,
  type CalendarDay,
  type CalendarView,
} from "@/libs/calendarView"
import type { RelativeDayLabels } from "@/libs/format"
import { formatDateRange, formatRelativeDay } from "@/libs/format"
import type { PerformanceStatus } from "@/interfaces/performance"
import { parseIsoDate } from "@/libs/validation"
import { toFriendlyError } from "@/services/errors"
import { performanceDays, performanceLastDay, todayIsoDate } from "@/services/performances"

const VIEW_KEYS: Record<CalendarView, string> = {
  month: "calendar.viewMonth",
  week: "calendar.viewWeek",
  agenda: "calendar.viewAgenda",
}

// The status labels already live under `performances`, used nowhere else — the
// chips reuse them rather than carrying a second copy of the same three words.
const STATUS_KEYS: Record<PerformanceStatus, string> = {
  scheduled: "performances.scheduled",
  completed: "performances.completed",
  cancelled: "performances.cancelled",
}

/**
 * Band calendar (docs §23): a month grid with show markers plus the agenda for
 * the selected day, and — since roadmap #51 — a week view over the same seven
 * days and a running agenda from today, both filtered by status.
 *
 * The view and the statuses are session state, not preferences: remembering
 * them is the storage shape the songbook already owns, and that is a decision
 * of its own rather than a detail of this one.
 */
export default function CalendarScreen() {
  const { t, i18n } = useTranslation()
  const dayLabels: RelativeDayLabels = {
    today: t("common.today"),
    tomorrow: t("common.tomorrow"),
    yesterday: t("common.yesterday"),
  }
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { isAdmin, organization, organizationId } = useOrganization()
  const { performances, error } = useOrgData()

  const [exporting, setExporting] = useState(false)
  const [view, setView] = useState<CalendarView>("month")
  const [statuses, setStatuses] = useState<PerformanceStatus[]>([...DEFAULT_STATUSES])
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1, 12)
  })
  const [selected, setSelected] = useState<string | null>(() => todayIsoDate())

  // Everything below reads the filtered list, so the chips move the dots, the
  // day agenda and the upcoming list together rather than only the list.
  const filtered = useMemo(() => filterByStatus(performances, statuses), [performances, statuses])
  const counts = useMemo(() => dayCounts(filtered), [filtered])

  const dayShows = useMemo(
    () =>
      selected === null ?
        []
      : filtered
          .filter((performance) => performanceDays(performance).includes(selected))
          .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [filtered, selected],
  )

  const upcoming = useMemo(
    () =>
      filtered.filter(
        (performance) =>
          performance.status === "scheduled" && performanceLastDay(performance) >= todayIsoDate(),
      ),
    [filtered],
  )

  // The week view anchors on the selected day, so its arrows move the selection
  // by a whole week and "back to today" lands it on today's week.
  const weekStart = weekStartIso(selected ?? todayIsoDate())
  const weekGroups = useMemo(
    () => groupByDay(filtered, { days: weekDays(weekStart) }),
    [filtered, weekStart],
  )
  const agendaGroups = useMemo(
    () => upcomingByDay(filtered, todayIsoDate()),
    [filtered],
  )

  const toggleStatus = (status: PerformanceStatus): void =>
    setStatuses((current) => {
      const next = current.includes(status) ?
        current.filter((entry) => entry !== status)
      : [...current, status]
      // Never leave the row empty: with nothing selected the calendar would fall
      // back to the default while every chip read as off.
      return next.length > 0 ? next : [...DEFAULT_STATUSES]
    })

  const exportCalendar = async (): Promise<void> => {
    setExporting(true)
    try {
      const shared = await exportPerformancesToIcs({
        performances,
        organizationId: organizationId ?? "",
        calendarName: organization?.name ?? t("calendar.calendar"),
        fileLabel: organization?.name ?? t("calendar.calendar"),
        dialogTitle: t("calendar.exportAll"),
      })
      if (shared) toast.showSuccess(t("calendar.exported"))
      else toast.showError(t("calendar.exportUnavailable"))
    } catch (caught) {
      toast.showError(toFriendlyError(caught, t("calendar.couldNotExport")))
    } finally {
      setExporting(false)
    }
  }

  const renderGroups = (groups: CalendarDay[]): React.ReactNode =>
    groups.map((group) => (
      <View key={group.iso} style={styles.dayGroup}>
        <AppText variant="label" tone="faint">
          {formatRelativeDay(parseIsoDate(group.iso), dayLabels)}
        </AppText>
        {group.performances.map((performance) => (
          <PerformanceListRow
            key={performance.id}
            performance={performance}
            onPress={() => router.push(`/performances/${performance.id}`)}
          />
        ))}
      </View>
    ))

  const emptyGroups = (
    <EmptyState
      compact
      icon={<CalendarIcon size={22} color={Theme.colors.textFaint} />}
      title={view === "week" ? t("calendar.weekEmpty") : t("calendar.agendaEmpty")}
      message={isAdmin ? t("calendar.emptyAdmin") : t("calendar.emptyMember")}
      actionLabel={isAdmin ? t("performances.schedule") : undefined}
      onAction={isAdmin ? () => router.push("/performances/new") : undefined}
    />
  )

  return (
    <ScreenContainer
      title={t("calendar.calendar")}
      subtitle={t("calendar.subtitle")}
      large
      headerRight={
        <IconButton
          label={t("calendar.exportAll")}
          disabled={exporting || performances.length === 0}
          onPress={() => void exportCalendar()}
          icon={<CalendarCheckIcon size={18} color={Theme.colors.textMuted} />}
        />
      }
    >
      {error ? <ErrorState message={error} /> : null}

      <Card style={styles.calendar}>
        <View style={styles.chips}>
          {CALENDAR_VIEWS.map((option) => (
            <Chip
              key={option}
              label={t(VIEW_KEYS[option])}
              tone="primary"
              selected={view === option}
              onPress={() => setView(option)}
            />
          ))}
        </View>

        <View style={styles.chips}>
          {CALENDAR_STATUSES.map((status) => (
            <Chip
              key={status}
              label={t(STATUS_KEYS[status])}
              selected={statuses.includes(status)}
              onPress={() => toggleStatus(status)}
            />
          ))}
        </View>

        {view === "month" ? (
          <CalendarMonth
            month={month}
            selected={selected}
            counts={counts}
            onShiftMonth={(delta) =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1, 12))
            }
            onSelectDay={(iso) => {
              setSelected(iso)
              const date = parseIsoDate(iso)
              if (
                date &&
                (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear())
              ) {
                setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12))
              }
            }}
          />
        ) : null}

        {view === "week" ? (
          <CalendarWeek
            day={parseIsoDate(weekStart) ?? new Date()}
            selected={selected}
            counts={counts}
            onShiftWeek={(delta) => setSelected(shiftWeek(selected ?? todayIsoDate(), delta))}
            onSelectDay={setSelected}
          />
        ) : null}

        <Button
          label={t("calendar.backToToday")}
          variant="ghost"
          size="sm"
          onPress={() => {
            const now = new Date()
            setMonth(new Date(now.getFullYear(), now.getMonth(), 1, 12))
            setSelected(todayIsoDate())
          }}
        />
      </Card>

      {view === "month" ? (
        <Section
          title={selected ? formatRelativeDay(parseIsoDate(selected), dayLabels) : t("calendar.pickDay")}
          subtitle={t("calendar.agendaSubtitle")}
        >
          {dayShows.length === 0 ? (
            <EmptyState
              compact
              icon={<CalendarIcon size={22} color={Theme.colors.textFaint} />}
              title={t("calendar.nothingOnDay")}
              message={isAdmin ? t("calendar.emptyAdmin") : t("calendar.emptyMember")}
              actionLabel={isAdmin ? t("performances.schedule") : undefined}
              onAction={isAdmin ? () => router.push("/performances/new") : undefined}
            />
          ) : (
            dayShows.map((performance) => (
              <PerformanceListRow
                key={performance.id}
                performance={performance}
                onPress={() => router.push(`/performances/${performance.id}`)}
              />
            ))
          )}
        </Section>
      ) : null}

      {view === "week" ? (
        <Section title={t("performances.thisWeek")}>
          {weekGroups.length === 0 ? emptyGroups : renderGroups(weekGroups)}
        </Section>
      ) : null}

      {view === "agenda" ? (
        <Section title={t("calendar.stillToCome")}>
          {agendaGroups.length === 0 ? emptyGroups : renderGroups(agendaGroups)}
        </Section>
      ) : null}

      {view === "month" ? (
        <Section
          title={t("calendar.stillToCome")}
          action={
            isAdmin ? (
              <Button
                label={t("performances.schedule")}
                size="sm"
                variant="secondary"
                icon={<PlusIcon size={16} color={Theme.colors.text} />}
                onPress={() => router.push("/performances/new")}
              />
            ) : undefined
          }
        >
          {upcoming.length === 0 ? (
            <AppText variant="caption" tone="faint">
              {t("calendar.noShowsScheduled")}
            </AppText>
          ) : (
            upcoming.slice(0, 8).map((performance) => (
              <Card
                key={performance.id}
                onPress={() => router.push(`/performances/${performance.id}`)}
                style={styles.upcomingRow}
              >
                <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                  {performance.name}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {formatDateRange(performance.date, performance.endDate, i18n.language)}
                </AppText>
              </Card>
            ))
          )}
        </Section>
      ) : null}
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    calendar: { gap: Theme.spacing.m },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.xs },
    dayGroup: { gap: Theme.spacing.s },
    upcomingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.s,
    },
    flex: { flex: 1, minWidth: 0 },
  })

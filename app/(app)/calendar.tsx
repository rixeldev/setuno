import React, { useMemo, useState } from "react"
import { StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Card, Section } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { EmptyState, ErrorState } from "@/components/ui/States"
import { CalendarIcon, PlusIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { CalendarMonth } from "@/components/performances/CalendarMonth"
import { PerformanceListRow } from "@/components/performances/PerformanceCard"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import type { RelativeDayLabels } from "@/libs/format"
import { formatDateRange, formatRelativeDay } from "@/libs/format"
import { parseIsoDate } from "@/libs/validation"
import { performanceDays, performanceLastDay, todayIsoDate } from "@/services/performances"

/**
 * Band calendar (docs §23): month grid with show markers plus the agenda for
 * the selected day.
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
  const { isAdmin } = useOrganization()
  const { performances, error } = useOrgData()

  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1, 12)
  })
  const [selected, setSelected] = useState<string | null>(() => todayIsoDate())

  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const performance of performances) {
      if (performance.status === "cancelled") continue
      // A multi-day run marks every day it occupies.
      for (const day of performanceDays(performance)) {
        result[day] = (result[day] ?? 0) + 1
      }
    }
    return result
  }, [performances])

  const dayShows = useMemo(
    () =>
      performances
        .filter((performance) => performanceDays(performance).includes(selected ?? ""))
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [performances, selected],
  )

  const upcoming = useMemo(
    () =>
      performances.filter(
        (performance) =>
          performance.status === "scheduled" && performanceLastDay(performance) >= todayIsoDate(),
      ),
    [performances],
  )

  return (
    <ScreenContainer title={t("calendar.calendar")} subtitle={t("calendar.subtitle")} large>
      {error ? <ErrorState message={error} /> : null}

      <Card style={styles.calendar}>
        <CalendarMonth
          month={month}
          selected={selected}
          counts={counts}
          onShiftMonth={(delta) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1, 12))}
          onSelectDay={(iso) => {
            setSelected(iso)
            const date = parseIsoDate(iso)
            if (date && (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear())) {
              setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12))
            }
          }}
        />
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
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    calendar: { gap: Theme.spacing.m },
    upcomingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.s,
    },
    flex: { flex: 1, minWidth: 0 },
  })
import React, { useMemo, useState } from "react"
import { StyleSheet } from "react-native"
import { useRouter } from "expo-router"

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
import { formatRelativeDay, formatShortDate } from "@/libs/format"
import { parseIsoDate } from "@/libs/validation"
import { todayIsoDate } from "@/services/performances"

/**
 * Band calendar (docs §23): month grid with show markers plus the agenda for
 * the selected day.
 */
export default function CalendarScreen() {
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
      result[performance.date] = (result[performance.date] ?? 0) + 1
    }
    return result
  }, [performances])

  const dayShows = useMemo(
    () =>
      performances
        .filter((performance) => performance.date === selected)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [performances, selected],
  )

  const upcoming = useMemo(
    () =>
      performances.filter((performance) => performance.status === "scheduled" && performance.date >= todayIsoDate()),
    [performances],
  )

  return (
    <ScreenContainer title="Calendar" subtitle="Every show and rehearsal" large>
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
          label="Back to today"
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
        title={selected ? formatRelativeDay(parseIsoDate(selected)) : "Pick a day"}
        subtitle="Agenda for the selected day"
      >
        {dayShows.length === 0 ? (
          <EmptyState
            compact
            icon={<CalendarIcon size={22} color={Theme.colors.textFaint} />}
            title="Nothing on this day"
            message={isAdmin ? "Add a show on this date." : "Your band has nothing booked for this day."}
            actionLabel={isAdmin ? "Schedule a show" : undefined}
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
        title="Still to come"
        action={
          isAdmin ? (
            <Button
              label="Schedule a show"
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
            No shows scheduled.
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
              <AppText variant="caption" tone="muted">
                {formatShortDate(parseIsoDate(performance.date))}
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
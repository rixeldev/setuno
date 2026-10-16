import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { Chip } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { CalendarCheckIcon, PlusIcon, PollIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { PerformanceCard } from "@/components/performances/PerformanceCard"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { DEFAULT_EVENT_TYPES, EVENT_TYPES, filterByEventType } from "@/libs/performances"
import { PERFORMANCE_TYPE_KEYS } from "@/interfaces/performance"
import type { PerformanceType } from "@/interfaces/performance"

const TABS = [
  { key: "upcoming", labelKey: "performances.upcoming" },
  { key: "past", labelKey: "performances.past" },
] as const

type TabKey = (typeof TABS)[number]["key"]

/**
 * Gigs and rehearsals (docs §22): upcoming first, history below, each narrowed
 * by the event-type chips (roadmap #46) once the band has a rehearsal.
 */
export default function PerformancesScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const { isAdmin } = useOrganization()
  const { performances, upcomingPerformances, pastPerformances, loading, error } = useOrgData()
  const [tab, setTab] = useState<TabKey>("upcoming")
  const [types, setTypes] = useState<PerformanceType[]>([...DEFAULT_EVENT_TYPES])

  // The type row only shows up once the band has a rehearsal to show or hide.
  const hasRehearsal = performances.some((entry) => entry.type === "rehearsal")
  const toggleType = (type: PerformanceType): void =>
    setTypes((current) => {
      const next = current.includes(type) ?
        current.filter((entry) => entry !== type)
      : [...current, type]
      // Never leave nothing selected: the list would fall back to the default
      // while every chip read as off.
      return next.length > 0 ? next : [...DEFAULT_EVENT_TYPES]
    })

  const base = tab === "upcoming" ? upcomingPerformances : pastPerformances
  const visible = useMemo(() => filterByEventType(base, types), [base, types])
  // The tab counts follow the filter, so the number and the list can never
  // disagree about how many events are being shown.
  const upcomingCount = useMemo(
    () => filterByEventType(upcomingPerformances, types).length,
    [upcomingPerformances, types],
  )
  const pastCount = useMemo(
    () => filterByEventType(pastPerformances, types).length,
    [pastPerformances, types],
  )

  // Filtered out is not the same as gone: an empty list whose band still has
  // events of another type says so, instead of reading like a fresh band.
  const emptyTitle =
    base.length > 0 ? t("performances.emptyFiltered")
    : tab === "upcoming" ? t("dashboard.noGig")
    : t("performances.noPast")
  const emptyMessage =
    base.length > 0 ? t("performances.emptyFilteredHint")
    : tab === "upcoming" ?
      isAdmin ? t("performances.emptyUpcomingAdmin")
      : t("performances.emptyUpcomingMember")
    : t("performances.emptyPast")

  return (
    <ScreenContainer
      title={t("performances.shows")}
      subtitle={
        loading ? t("performances.loading") : t("organizations.showsCount", { count: performances.length })
      }
      large
      headerRight={
        <View style={styles.headerActions}>
          {/* Any member may propose dates (roadmap #48) — only scheduling an
              event from the winner is admin territory. */}
          <IconButton
            label={t("polls.title")}
            variant="secondary"
            onPress={() => router.push("/polls/index")}
            icon={<PollIcon size={18} color={Theme.colors.text} />}
          />
          {isAdmin ? (
            <IconButton
              label={t("performances.schedule")}
              variant="secondary"
              onPress={() => router.push("/performances/new")}
              icon={<PlusIcon size={18} color={Theme.colors.text} />}
            />
          ) : null}
        </View>
      }
      toolbar={
        <View style={styles.toolbar}>
          <View style={styles.segment}>
            {TABS.map((entry) => (
              <Chip
                key={entry.key}
                label={`${t(entry.labelKey)} (${entry.key === "upcoming" ? upcomingCount : pastCount})`}
                tone="primary"
                selected={tab === entry.key}
                onPress={() => setTab(entry.key)}
              />
            ))}
          </View>

          {hasRehearsal ? (
            <View style={styles.filterRow}>
              {EVENT_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={t(PERFORMANCE_TYPE_KEYS[type])}
                  selected={types.includes(type)}
                  onPress={() => toggleType(type)}
                />
              ))}
            </View>
          ) : null}
        </View>
      }
    >
      {error ? <ErrorState message={error} /> : null}

      {loading ? (
        <SkeletonList count={3} height={92} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<CalendarCheckIcon size={24} color={Theme.colors.primary} />}
          title={emptyTitle}
          message={emptyMessage}
          actionLabel={
            isAdmin && tab === "upcoming" && base.length === 0
              ? t("performances.schedule")
              : undefined
          }
          onAction={
            isAdmin && tab === "upcoming" && base.length === 0
              ? () => router.push("/performances/new")
              : undefined
          }
        />
      ) : (
        <View style={styles.list}>
          {visible.map((performance) => (
            <PerformanceCard
              key={performance.id}
              performance={performance}
              onPress={() => router.push(`/performances/${performance.id}`)}
            />
          ))}
          {isAdmin && tab === "upcoming" ? (
            <Button
              label={t("performances.schedule")}
              variant="secondary"
              icon={<PlusIcon size={16} color={Theme.colors.text} />}
              onPress={() => router.push("/performances/new")}
            />
          ) : null}
        </View>
      )}
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    // The header's trailing controls: the polls entry plus the admin's own.
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.xs,
    },
    toolbar: {
      gap: 6,
      alignSelf: "flex-start",
    },
    segment: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      alignSelf: "flex-start",
      padding: 4,
      // Matches the chips' own radius instead of going full pill (see the
      // suggestions filters).
      borderRadius: Theme.radii.lg,
      backgroundColor: Theme.colors.surfaceHigh,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
    },
    // The type chips sit plainly on the screen, like the calendar's filter
    // rows — only the tab row carries the pill container.
    filterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      alignSelf: "flex-start",
    },
    list: { gap: Theme.spacing.m },
  })
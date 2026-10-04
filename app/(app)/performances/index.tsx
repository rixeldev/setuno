import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { Chip } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { CalendarCheckIcon, PlusIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { PerformanceCard } from "@/components/performances/PerformanceCard"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { pluralize } from "@/libs/format"

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
] as const

type TabKey = (typeof TABS)[number]["key"]

/** Gigs and rehearsals (docs §22): upcoming first, history below. */
export default function PerformancesScreen() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const { isAdmin } = useOrganization()
  const { performances, upcomingPerformances, pastPerformances, loading, error } = useOrgData()
  const [tab, setTab] = useState<TabKey>("upcoming")

  const visible = useMemo(
    () => (tab === "upcoming" ? upcomingPerformances : pastPerformances),
    [tab, upcomingPerformances, pastPerformances],
  )

  return (
    <ScreenContainer
      title="Shows"
      subtitle={loading ? "Loading the calendar…" : pluralize(performances.length, "show")}
      large
      headerRight={
        isAdmin ? (
          <IconButton
            label="Schedule a show"
            variant="secondary"
            onPress={() => router.push("/performances/new")}
            icon={<PlusIcon size={18} color={Theme.colors.text} />}
          />
        ) : null
      }
      toolbar={
        <View style={styles.segment}>
          {TABS.map((entry) => (
            <Chip
              key={entry.key}
              label={`${entry.label} (${entry.key === "upcoming" ? upcomingPerformances.length : pastPerformances.length})`}
              tone="primary"
              selected={tab === entry.key}
              onPress={() => setTab(entry.key)}
            />
          ))}
        </View>
      }
    >
      {error ? <ErrorState message={error} /> : null}

      {loading ? (
        <SkeletonList count={3} height={92} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<CalendarCheckIcon size={24} color={Theme.colors.primary} />}
          title={tab === "upcoming" ? "Nothing booked yet" : "No past shows"}
          message={
            tab === "upcoming"
              ? isAdmin
                ? "Add your next gig or rehearsal and attach a setlist to it."
                : "Your admin hasn't booked anything yet."
              : "Shows you have marked as completed show up here."
          }
          actionLabel={isAdmin && tab === "upcoming" ? "Schedule a show" : undefined}
          onAction={isAdmin && tab === "upcoming" ? () => router.push("/performances/new") : undefined}
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
              label="Schedule a show"
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
    segment: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      alignSelf: "flex-start",
      padding: 4,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.surfaceHigh,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
    },
    list: { gap: Theme.spacing.m },
  })
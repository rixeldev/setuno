import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { Chip } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { CalendarCheckIcon, PlusIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { PerformanceCard } from "@/components/performances/PerformanceCard"
import { BannerAdSlot } from "@/components/ads/BannerAdSlot"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"

const TABS = [
  { key: "upcoming", labelKey: "performances.upcoming" },
  { key: "past", labelKey: "performances.past" },
] as const

type TabKey = (typeof TABS)[number]["key"]

/** Gigs and rehearsals (docs §22): upcoming first, history below. */
export default function PerformancesScreen() {
  const { t } = useTranslation()
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
      title={t("performances.shows")}
      subtitle={
        loading ? t("performances.loading") : t("organizations.showsCount", { count: performances.length })
      }
      large
      headerRight={
        isAdmin ? (
          <IconButton
            label={t("performances.schedule")}
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
              label={`${t(entry.labelKey)} (${entry.key === "upcoming" ? upcomingPerformances.length : pastPerformances.length})`}
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
          title={tab === "upcoming" ? t("dashboard.noGig") : t("performances.noPast")}
          message={
            tab === "upcoming"
              ? isAdmin
                ? t("performances.emptyUpcomingAdmin")
                : t("performances.emptyUpcomingMember")
              : t("performances.emptyPast")
          }
          actionLabel={isAdmin && tab === "upcoming" ? t("performances.schedule") : undefined}
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
              label={t("performances.schedule")}
              variant="secondary"
              icon={<PlusIcon size={16} color={Theme.colors.text} />}
              onPress={() => router.push("/performances/new")}
            />
          ) : null}
        </View>
      )}

      <BannerAdSlot />
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
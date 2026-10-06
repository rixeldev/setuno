import React from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card } from "@/components/ui/Card"
import { IconButton } from "@/components/ui/Button"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { ListIcon, PlusIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import type { RelativeDayLabels } from "@/libs/format"
import { formatDurationLong, formatRelativeDay } from "@/libs/format"
import { parseIsoDate } from "@/libs/validation"

/** Reusable running orders for gigs and rehearsals (docs §20). */
export default function SetlistsScreen() {
  const { t } = useTranslation()
  const dayLabels: RelativeDayLabels = {
    today: t("common.today"),
    tomorrow: t("common.tomorrow"),
    yesterday: t("common.yesterday"),
  }
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const { isAdmin } = useOrganization()
  const { setlists, loading, error } = useOrgData()

  return (
    <ScreenContainer
      title={t("setlists.setlists")}
      subtitle={
        loading ? t("setlists.loading") : t("organizations.setlistsCount", { count: setlists.length })
      }
      large
      headerRight={
        isAdmin ? (
          <IconButton
            label={t("setlists.newSetlist")}
            variant="secondary"
            onPress={() => router.push("/setlists/new")}
            icon={<PlusIcon size={18} color={Theme.colors.text} />}
          />
        ) : null
      }
    >
      {error ? <ErrorState message={error} /> : null}

      {loading ? (
        <SkeletonList count={3} height={96} />
      ) : setlists.length === 0 ? (
        <EmptyState
          icon={<ListIcon size={24} color={Theme.colors.primary} />}
          title={t("setlists.noSetlists")}
          message={isAdmin ? t("setlists.emptyAdmin") : t("setlists.emptyMember")}
          actionLabel={isAdmin ? t("setlists.newSetlist") : undefined}
          onAction={isAdmin ? () => router.push("/setlists/new") : undefined}
        />
      ) : (
        <View style={styles.list}>
          {setlists.map((setlist) => (
            <Card
              key={setlist.id}
              onPress={() => router.push(`/setlists/${setlist.id}`)}
              accessibilityLabel={`${setlist.name}, ${t("organizations.songsCount", { count: setlist.songs.length })}`}
              style={{ gap: Theme.spacing.s }}
            >
              <View style={styles.row}>
                <AppText variant="subheading" numberOfLines={1} style={styles.flex}>
                  {setlist.name}
                </AppText>
                {setlist.date ? (
                  <Badge label={formatRelativeDay(parseIsoDate(setlist.date), dayLabels)} tone="primary" />
                ) : null}
              </View>

              {setlist.description.trim().length > 0 ? (
                <AppText variant="caption" tone="muted" numberOfLines={2}>
                  {setlist.description}
                </AppText>
              ) : null}

              <AppText variant="caption" tone="faint">
                {t("setlists.songsCount", {
                  count: setlist.songs.length,
                  duration: formatDurationLong(setlist.estimatedDurationSec),
                })}
              </AppText>
            </Card>
          ))}
        </View>
      )}
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    list: { gap: Theme.spacing.m },
    row: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    flex: { flex: 1, minWidth: 0 },
  })
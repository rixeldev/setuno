import React, { useMemo } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Card, Section } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { ChevronRightIcon, ListIcon, PlusIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { formatDurationLong } from "@/libs/format"
import { groupSetlists } from "@/libs/setlistGroups"

/**
 * Setlists live with their events (docs §20): each upcoming event lists the
 * running orders attached to it, and lists whose event already passed or was
 * completed disappear from here (they remain reachable from the event itself).
 * Lists not attached to anything keep their own section — and **templates sit
 * outside events entirely** (roadmap #41), in a section of their own.
 *
 * The grouping itself is `libs/setlistGroups.ts`, pure and tested.
 */
export default function SetlistsScreen() {
  const { t, i18n } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const { isAdmin } = useOrganization()
  const { setlists, performances, upcomingPerformances, loading, error } = useOrgData()

  const groups = useMemo(
    () =>
      groupSetlists({
        setlists,
        performances,
        upcomingPerformances,
        language: i18n.language,
        templatesTitle: t("setlists.templates"),
        unattachedTitle: t("setlists.withoutEvent"),
      }),
    [i18n.language, performances, setlists, t, upcomingPerformances],
  )

  const visibleCount = groups.reduce((total, group) => total + group.lists.length, 0)

  return (
    <ScreenContainer
      title={t("setlists.setlists")}
      subtitle={
        loading
          ? t("setlists.loading")
          : t("organizations.setlistsCount", { count: visibleCount })
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
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<ListIcon size={24} color={Theme.colors.primary} />}
          title={t("setlists.noSetlists")}
          message={isAdmin ? t("setlists.emptyAdmin") : t("setlists.emptyMember")}
          actionLabel={isAdmin ? t("setlists.newSetlist") : undefined}
          onAction={isAdmin ? () => router.push("/setlists/new") : undefined}
        />
      ) : (
        groups.map((group) => (
          <Section
            key={group.key}
            title={group.title}
            subtitle={group.subtitle}
            action={
              group.eventId ? (
                <Button
                  label={t("performances.viewPerformance")}
                  size="sm"
                  variant="ghost"
                  onPress={() => router.push(`/performances/${group.eventId}`)}
                />
              ) : undefined
            }
          >
            <Card padded={false} style={styles.surface}>
              {group.lists.map((setlist, index) => (
                <Pressable
                  key={setlist.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${setlist.name}, ${t("organizations.songsCount", {
                    count: setlist.songs.length,
                  })}`}
                  onPress={() => router.push(`/setlists/${setlist.id}`)}
                  style={({ pressed }) => [
                    styles.row,
                    index > 0 && styles.divider,
                    pressed && styles.pressed,
                  ]}
                >
                  <ListIcon size={16} color={Theme.colors.primary} />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {setlist.name}
                    </AppText>
                    <AppText variant="caption" tone="faint" numberOfLines={1}>
                      {t("setlists.songsCount", {
                        count: setlist.songs.length,
                        duration: formatDurationLong(setlist.estimatedDurationSec),
                      })}
                    </AppText>
                  </View>
                  <ChevronRightIcon size={16} color={Theme.colors.textFaint} />
                </Pressable>
              ))}
            </Card>
          </Section>
        ))
      )}
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    surface: { overflow: "hidden" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingHorizontal: Theme.spacing.l,
      paddingVertical: Theme.spacing.m,
    },
    divider: { borderTopWidth: 1, borderTopColor: Theme.colors.borderSoft },
    flex: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.7 },
  })

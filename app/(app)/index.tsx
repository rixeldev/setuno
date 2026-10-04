import React, { useMemo } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card, Chip, Section } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import {
  CalendarIcon,
  ChatIcon,
  ChevronRightIcon,
  ListIcon,
  MusicIcon,
  PlusIcon,
  StarIcon,
  UsersIcon,
} from "@/components/ui/Icons"
import { Avatar } from "@/components/ui/Avatar"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { StatRow, StatTile } from "@/components/app/StatTile"
import { SongRow } from "@/components/app/SongRow"
import { PERFORMANCE_STATUS_TONES } from "@/components/performances/PerformanceCard"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import type { RelativeDayLabels } from "@/libs/format"
import {
  dayStamp,
  formatDateLong,
  formatRelativeDay,
  formatTime,
} from "@/libs/format"
import { parseIsoDate } from "@/libs/validation"

const MAX_RECENT_SONGS = 4
const MAX_UPCOMING = 3

/**
 * Dashboard: what the band needs right now (docs §17) — the next show, the
 * counts that matter, pending suggestions and the latest changes.
 */
export default function Dashboard() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const { organization, isAdmin, role, state } = useOrganization()
  const {
    songs,
    setlists,
    stats,
    loading,
    error,
    nextShow,
    upcomingPerformances,
    pendingSuggestions,
    activity,
    members,
  } = useOrgData()

  const dayLabels: RelativeDayLabels = {
    today: t("common.today"),
    tomorrow: t("common.tomorrow"),
    yesterday: t("common.yesterday"),
  }

  const recentSongs = useMemo(
    () =>
      [...songs]
        .sort((a, b) => {
          const left = a.updatedAt?.seconds ?? 0
          const right = b.updatedAt?.seconds ?? 0
          return right - left
        })
        .slice(0, MAX_RECENT_SONGS),
    [songs],
  )

  const upcoming = useMemo(() => upcomingPerformances.slice(0, MAX_UPCOMING), [upcomingPerformances])
  const today = useMemo(() => new Date(), [])

  if (error) {
    return (
      <ScreenContainer title={t("dashboard.dashboard")}>
        <ErrorState message={error} />
      </ScreenContainer>
    )
  }

  // The signed-in musician: photo when there is one, first letter otherwise,
  // with the name beside it. Opens the profile settings.
  const accountName = profile?.displayName || profile?.email || ""
  const account = (
    <Pressable
      onPress={() => router.push("/settings/profile")}
      accessibilityRole="button"
      accessibilityLabel={t("settings.profile")}
      hitSlop={Theme.hitSlop}
      style={({ pressed }) => [styles.account, pressed && styles.accountPressed]}
    >
      <Avatar name={accountName} photoURL={profile?.photoURL} size={36} maxInitials={1} />
      {accountName ? (
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.accountName}>
          {accountName}
        </AppText>
      ) : null}
    </Pressable>
  )

  // Accounts are not tied to a band: a new user lands here and decides later
  // whether to lead a band or wait for an invitation (docs §7).
  if (state === "needs-organization") {
    const features = [
      {
        icon: MusicIcon,
        title: t("dashboard.featureSongbook"),
        text: t("dashboard.featureSongbookHint"),
      },
      {
        icon: ListIcon,
        title: t("dashboard.featureSetlists"),
        text: t("dashboard.featureSetlistsHint"),
      },
      { icon: CalendarIcon, title: t("dashboard.featureGigs"), text: t("dashboard.featureGigsHint") },
    ]

    return (
      <ScreenContainer
        title={t("dashboard.setupTitle")}
        subtitle={t("dashboard.setupSubtitle")}
        large
        headerTop={account}
      >
        <View style={styles.features}>
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <View key={feature.title} style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Icon size={17} color={Theme.colors.primary} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{feature.title}</AppText>
                  <AppText variant="caption" tone="muted">
                    {feature.text}
                  </AppText>
                </View>
              </View>
            )
          })}
        </View>

        <View style={styles.setupActions}>
          <Button label={t("organizations.createBand")} onPress={() => router.push("/organizations/new")} />
          <Button
            label={t("dashboard.setupInvitation")}
            variant="ghost"
            onPress={() => router.push("/organizations")}
          />
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer
      title={organization?.name ?? t("dashboard.dashboard")}
      subtitle={`${formatDateLong(today, i18n.language)} · ${t("organizations.membersCount", {
        count: members.length,
      })}`}
      large
      headerTop={
        <View style={styles.topBar}>
          {account}
          {isAdmin ? (
            <IconButton
              label={t("dashboard.addSong")}
              variant="secondary"
              onPress={() => router.push("/songs/new")}
              icon={<PlusIcon size={18} color={Theme.colors.primary} />}
            />
          ) : null}
        </View>
      }
      toolbar={
        <View style={styles.quick}>
          <AppText variant="caption" tone="muted">
            {role === "admin" ? t("dashboard.adminNote") : t("dashboard.memberNote")}
          </AppText>
          <View style={styles.quickActions}>
            {isAdmin ? (
              <>
                <Button
                  label={t("dashboard.addSong")}
                  size="sm"
                  variant="secondary"
                  icon={<PlusIcon size={15} color={Theme.colors.text} />}
                  onPress={() => router.push("/songs/new")}
                />
                <Button
                  label={t("dashboard.newSetlist")}
                  size="sm"
                  variant="secondary"
                  icon={<ListIcon size={15} color={Theme.colors.text} />}
                  onPress={() => router.push("/setlists/new")}
                />
                <Button
                  label={t("dashboard.bookGig")}
                  size="sm"
                  variant="secondary"
                  icon={<CalendarIcon size={15} color={Theme.colors.text} />}
                  onPress={() => router.push("/performances/new")}
                />
              </>
            ) : (
              <Button
                label={t("dashboard.openSongbook")}
                size="sm"
                variant="secondary"
                icon={<MusicIcon size={15} color={Theme.colors.text} />}
                onPress={() => router.push("/songs")}
              />
            )}
          </View>
        </View>
      }
    >
      {nextShow ? (
        <Card
          onPress={() => router.push(`/performances/${nextShow.id}`)}
          accessibilityLabel={`${nextShow.name}, ${formatRelativeDay(
            parseIsoDate(nextShow.date),
            dayLabels,
          )}`}
          style={styles.hero}
          elevated
        >
          <View style={styles.stamp}>
            <AppText variant="label" tone="primary">
              {dayStamp(parseIsoDate(nextShow.date)).weekday}
            </AppText>
            <AppText variant="title" tone="primary">
              {dayStamp(parseIsoDate(nextShow.date)).day}
            </AppText>
            <AppText variant="caption" tone="faint">
              {dayStamp(parseIsoDate(nextShow.date)).month}
            </AppText>
          </View>

          <View style={styles.heroBody}>
            <View style={styles.heroTitle}>
              <AppText variant="subheading" numberOfLines={1} style={styles.flex}>
                {nextShow.name}
              </AppText>
              <Badge
                label={t(`performances.${nextShow.status}`)}
                tone={PERFORMANCE_STATUS_TONES[nextShow.status]}
              />
            </View>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {[
                formatRelativeDay(parseIsoDate(nextShow.date), dayLabels),
                nextShow.startTime ? formatTime(nextShow.startTime) : null,
                nextShow.venue.name,
              ]
                .filter(Boolean)
                .join(" · ") || t("dashboard.noGigDetails")}
            </AppText>
            {nextShow.setlistName ? (
              <Chip
                label={nextShow.setlistName}
                tone="accent"
                size="sm"
                icon={<ListIcon size={13} color={Theme.colors.accent} />}
              />
            ) : null}
          </View>

          <ChevronRightIcon size={18} color={Theme.colors.textFaint} />
        </Card>
      ) : (
        <Card style={styles.heroEmpty}>
          <View style={styles.heroEmptyIcon}>
            <CalendarIcon size={19} color={Theme.colors.primary} />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{t("dashboard.noGig")}</AppText>
            <AppText variant="caption" tone="muted">
              {isAdmin ? t("dashboard.noGigAdmin") : t("dashboard.noGigMember")}
            </AppText>
          </View>
          {isAdmin ? (
            <Button
              label={t("dashboard.bookGig")}
              size="sm"
              variant="secondary"
              onPress={() => router.push("/performances/new")}
            />
          ) : null}
        </Card>
      )}

      <StatRow>
        <StatTile
          label={t("nav.songs")}
          value={loading ? "—" : stats.songs}
          hint={loading ? t("common.loading") : t("songs.chordsCount", { count: stats.chords })}
          icon={MusicIcon}
          tone="primary"
          onPress={() => router.push("/songs")}
        />
        <StatTile
          label={t("nav.setlists")}
          value={setlists.length}
          hint={setlists.length > 0 ? t("dashboard.setlistsHint") : t("common.empty")}
          icon={ListIcon}
          onPress={() => router.push("/setlists")}
        />
        <StatTile
          label={t("dashboard.stats.upcomingShows")}
          value={upcomingPerformances.length}
          hint={
            nextShow
              ? formatRelativeDay(parseIsoDate(nextShow.date), dayLabels)
              : t("dashboard.noGig")
          }
          icon={CalendarIcon}
          onPress={() => router.push("/performances")}
        />
        <StatTile
          label={t("nav.members")}
          value={members.length}
          hint={isAdmin ? t("dashboard.youAreAdmin") : t("dashboard.bandMembers")}
          icon={UsersIcon}
          onPress={() => router.push("/members")}
        />
      </StatRow>

      {isAdmin && pendingSuggestions.length > 0 ? (
        <Section
          title={t("dashboard.suggestionsTitle")}
          subtitle={t("dashboard.suggestionsSubtitle")}
          action={
            <Button label={t("common.review")} size="sm" variant="secondary" onPress={() => router.push("/suggestions")} />
          }
        >
          <Card style={styles.cardList}>
            {pendingSuggestions.slice(0, 3).map((suggestion) => (
              <View
                key={suggestion.id}
                style={styles.suggestionRow}
                accessibilityRole="button"
                accessibilityLabel={`Suggestion from ${suggestion.authorName}: ${suggestion.summary}`}
                onTouchEnd={() => router.push(`/suggestions/${suggestion.id}`)}
              >
                <ChatIcon size={16} color={Theme.colors.accent} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {suggestion.songTitle}
                  </AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {suggestion.authorName} · {suggestion.summary}
                  </AppText>
                </View>
                <Badge label={t("suggestions.pending")} tone="warning" />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section
        title={t("dashboard.recentlyUpdated")}
        subtitle={loading ? undefined : t("organizations.songsCount", { count: songs.length })}
        action={
          <Button label={t("dashboard.allSongs")} size="sm" variant="ghost" onPress={() => router.push("/songs")} />
        }
      >
        {loading ? (
          <SkeletonList count={3} height={78} />
        ) : recentSongs.length === 0 ? (
          <EmptyState
            compact
            title={t("dashboard.noSongs")}
            message={t("dashboard.noSongsDescription")}
            actionLabel={isAdmin ? t("dashboard.addSong") : undefined}
            onAction={isAdmin ? () => router.push("/songs/new") : undefined}
          />
        ) : (
          <View style={styles.list}>
            {recentSongs.map((song) => (
              <SongRow key={song.id} song={song} onPress={() => router.push(`/songs/${song.id}`)} />
            ))}
          </View>
        )}
      </Section>

      {upcoming.length > 1 ? (
        <Section
          title={t("dashboard.comingUp")}
          action={
            <Button label={t("dashboard.viewCalendar")} size="sm" variant="ghost" onPress={() => router.push("/calendar")} />
          }
        >
          <View style={styles.list}>
            {upcoming.slice(1).map((performance) => (
              <Card
                key={performance.id}
                onPress={() => router.push(`/performances/${performance.id}`)}
                style={styles.showCard}
              >
                <View style={styles.stampSmall}>
                  <AppText variant="label" tone="primary">
                    {dayStamp(parseIsoDate(performance.date)).day}
                  </AppText>
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {performance.name}
                  </AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {formatRelativeDay(parseIsoDate(performance.date), dayLabels)}
                    {performance.startTime ? ` · ${formatTime(performance.startTime)}` : ""}
                    {performance.venue.name ? ` · ${performance.venue.name}` : ""}
                  </AppText>
                </View>
                <ChevronRightIcon size={16} color={Theme.colors.textFaint} />
              </Card>
            ))}
          </View>
        </Section>
      ) : null}

      {activity.length > 0 ? (
        <Section title={t("dashboard.bandActivity")}>
          <Card style={styles.cardList}>
            {activity.slice(0, 6).map((event) => (
              <View key={event.id} style={styles.activityRow}>
                <StarIcon size={13} color={Theme.colors.textFaint} />
                <AppText variant="caption" tone="muted" numberOfLines={2} style={styles.flex}>
                  {event.message}
                </AppText>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Theme.spacing.m },
    account: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      flex: 1,
      minWidth: 0,
      paddingVertical: 2,
      borderRadius: Theme.radii.pill,
    },
    accountPressed: { opacity: 0.7 },
    accountName: { flexShrink: 1 },
    quick: { gap: Theme.spacing.s },
    quickActions: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.s },
    features: { gap: Theme.spacing.m },
    feature: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    featureIcon: {
      width: 40,
      height: 40,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.surfaceHigh,
      alignItems: "center",
      justifyContent: "center",
    },
    setupActions: { gap: Theme.spacing.s },
    hero: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    heroBody: { flex: 1, minWidth: 0, gap: 4 },
    heroTitle: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    stamp: {
      minWidth: 64,
      paddingVertical: Theme.spacing.s,
      paddingHorizontal: Theme.spacing.s,
      borderRadius: Theme.radii.m,
      backgroundColor: Theme.colors.primarySoft,
      alignItems: "center",
      gap: 1,
    },
    stampSmall: {
      width: 36,
      height: 36,
      borderRadius: Theme.radii.m,
      backgroundColor: Theme.colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    heroEmpty: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    heroEmptyIcon: {
      width: 40,
      height: 40,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    cardList: { gap: Theme.spacing.s },
    list: { gap: Theme.spacing.m },
    showCard: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    suggestionRow: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    activityRow: { flexDirection: "row", alignItems: "flex-start", gap: Theme.spacing.s },
  })

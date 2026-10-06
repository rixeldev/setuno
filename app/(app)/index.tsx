import React, { useEffect, useMemo } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme, colorWithOpacity } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card, Section } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import {
  CalendarIcon,
  ChatIcon,
  ChevronRightIcon,
  ListIcon,
  MapPinIcon,
  MusicIcon,
  PlusIcon,
  UsersIcon,
} from "@/components/ui/Icons"
import { Avatar } from "@/components/ui/Avatar"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { SongRow } from "@/components/app/SongRow"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { seedDemoSongOnce } from "@/services/demoSong"
import type { RelativeDayLabels } from "@/libs/format"
import {
  dayStamp,
  formatDateLong,
  formatDateRange,
  formatRelativeDay,
  formatTime,
} from "@/libs/format"
import { parseIsoDate } from "@/libs/validation"
import { setlistSummary } from "@/libs/performanceSetlists"

const MAX_RECENT_SONGS = 3
const MAX_UPCOMING = 3
const MAX_ACTIVITY = 4

/**
 * Dashboard: what the band needs right now (docs §17). A visual hero for the
 * next show, one compact metrics strip, quick actions and a responsive grid
 * with the next gigs, the latest songs and the band activity.
 */
export default function Dashboard() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { profile } = useAuth()
  const { organization, organizationId, isAdmin, state, organizationsError, retryOrganizations } =
    useOrganization()
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

  const upcoming = useMemo(
    () => upcomingPerformances.slice(0, MAX_UPCOMING),
    [upcomingPerformances],
  )
  const today = useMemo(() => new Date(), [])

  // Publish the sample song once so the reader can be explored with real
  // content. The profile flag — not the song — decides, so deleting the sample
  // never brings it back.
  const demoSongSeeded = profile?.preferences?.demoSongSeeded === true
  useEffect(() => {
    if (!organizationId || !isAdmin || !profile?.uid || demoSongSeeded) return
    let active = true
    void seedDemoSongOnce({
      organizationId,
      uid: profile.uid,
      authorName: profile.displayName || "Stage Book",
      alreadySeeded: false,
    })
      .then((created) => {
        if (created && active) {
          toast.showSuccess(t("dashboard.demoSongAdded"))
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [organizationId, isAdmin, profile?.uid, profile?.displayName, demoSongSeeded, toast, t])

  if (error) {
    return (
      <ScreenContainer title={t("dashboard.dashboard")}>
        <ErrorState message={error} />
      </ScreenContainer>
    )
  }

  // The band list is still resolving: keep the dashboard's shape instead of
  // flashing the onboarding (“no band”) screen while we wait.
  if (state === "loading") {
    return (
      <ScreenContainer title={t("dashboard.dashboard")} large>
        <SkeletonList count={3} height={88} />
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
      style={({ pressed }) => [styles.account, pressed && styles.pressed]}
    >
      <Avatar
        name={accountName}
        photoURL={profile?.photoURL}
        size={36}
        maxInitials={1}
      />
      {accountName ? (
        <AppText
          variant="bodyStrong"
          numberOfLines={1}
          style={styles.accountName}
        >
          {accountName}
        </AppText>
      ) : null}
    </Pressable>
  )

  // Accounts are not tied to a band: a new user lands here and decides later
  // whether to lead a band or wait for an invitation (docs §7).
  if (state === "needs-organization") {
    // A band list that could not be read is not "no band": offer a retry
    // instead of inviting the user to create a duplicate organization.
    if (organizationsError) {
      return (
        <ScreenContainer
          title={t("dashboard.setupTitle")}
          subtitle={t("dashboard.setupSubtitle")}
          large
          headerTop={account}
        >
          <ErrorState message={organizationsError} onRetry={retryOrganizations} />
        </ScreenContainer>
      )
    }

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
      {
        icon: CalendarIcon,
        title: t("dashboard.featureGigs"),
        text: t("dashboard.featureGigsHint"),
      },
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
          <Button
            label={t("organizations.createBand")}
            onPress={() => router.push("/organizations/new")}
          />
          <Button
            label={t("dashboard.setupInvitation")}
            variant="ghost"
            onPress={() => router.push("/organizations")}
          />
        </View>
      </ScreenContainer>
    )
  }

  const metrics = [
    {
      key: "songs",
      label: t("nav.songs"),
      value: loading ? "—" : stats.songs,
      href: "/songs",
    },
    {
      key: "setlists",
      label: t("nav.setlists"),
      value: setlists.length,
      href: "/setlists",
    },
    {
      key: "gigs",
      label: t("nav.gigs"),
      value: upcomingPerformances.length,
      href: "/performances",
    },
    {
      key: "members",
      label: t("nav.members"),
      value: members.length,
      href: "/members",
    },
  ]

  const quickActions = isAdmin
    ? [
        {
          key: "song",
          label: t("dashboard.addSong"),
          icon: MusicIcon,
          href: "/songs/new",
        },
        {
          key: "setlist",
          label: t("dashboard.newSetlist"),
          icon: ListIcon,
          href: "/setlists/new",
        },
        {
          key: "gig",
          label: t("dashboard.bookGig"),
          icon: CalendarIcon,
          href: "/performances/new",
        },
        {
          key: "members",
          label: t("nav.members"),
          icon: UsersIcon,
          href: "/members",
        },
      ]
    : [
        {
          key: "songbook",
          label: t("dashboard.openSongbook"),
          icon: MusicIcon,
          href: "/songs",
        },
        {
          key: "suggest",
          label: t("suggestions.newSuggestion"),
          icon: ChatIcon,
          href: "/suggestions/new",
        },
        {
          key: "gigs",
          label: t("nav.gigs"),
          icon: CalendarIcon,
          href: "/performances",
        },
        {
          key: "members",
          label: t("nav.members"),
          icon: UsersIcon,
          href: "/members",
        },
      ]

  const stamp = nextShow ? dayStamp(parseIsoDate(nextShow.date)) : null
  const nextSetlistLabel = nextShow ? setlistSummary(nextShow.setlists) : ""
  const bandName = organization?.name || t("dashboard.dashboard")
  // Long band names step down a size and wrap instead of showing an ellipsis.
  const longBandName = bandName.length > 34

  return (
    <ScreenContainer
      title={bandName}
      subtitle={`${formatDateLong(today, i18n.language)} · ${t(
        "organizations.membersCount",
        {
          count: members.length,
        },
      )}`}
      large
      titleVariant={longBandName ? "title" : "display"}
      titleLines={longBandName ? 3 : 2}
      headerTop={
        <View style={styles.topBar}>
          {account}
          <Badge
            label={
              isAdmin ? t("organizations.admin") : t("organizations.member")
            }
            tone="primary"
          />
        </View>
      }
    >
      {nextShow && stamp ? (
        <Pressable
          onPress={() => router.push(`/performances/${nextShow.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${t("dashboard.nextShow")}: ${nextShow.name}, ${formatRelativeDay(
            parseIsoDate(nextShow.date),
            dayLabels,
          )}`}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <LinearGradient
            colors={[...Theme.gradients.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroStamp}>
              <AppText variant="label" tone="inverse">
                {stamp.weekday}
              </AppText>
              <AppText variant="title" tone="inverse">
                {stamp.day}
              </AppText>
              <AppText variant="caption" tone="inverse">
                {stamp.month}
              </AppText>
            </View>

            <View style={styles.heroBody}>
              <View style={styles.heroTitle}>
                <AppText
                  variant="subheading"
                  tone="inverse"
                  numberOfLines={1}
                  style={styles.flex}
                >
                  {nextShow.name}
                </AppText>
                <View style={styles.heroStatus}>
                  <AppText variant="caption" tone="inverse" numberOfLines={1}>
                    {t(`performances.${nextShow.status}`)}
                  </AppText>
                </View>
              </View>

              <View style={styles.heroMeta}>
                <CalendarIcon size={13} color={Theme.colors.onPrimary} />
                <AppText
                  variant="caption"
                  style={styles.heroMetaText}
                  numberOfLines={1}
                >
                  {[
                    nextShow.endDate
                      ? formatDateRange(nextShow.date, nextShow.endDate, i18n.language)
                      : formatRelativeDay(parseIsoDate(nextShow.date), dayLabels),
                    nextShow.startTime ? formatTime(nextShow.startTime) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || t("dashboard.noGigDetails")}
                </AppText>
              </View>

              {nextShow.venue.name ? (
                <View style={styles.heroMeta}>
                  <MapPinIcon size={13} color={Theme.colors.onPrimary} />
                  <AppText
                    variant="caption"
                    style={styles.heroMetaText}
                    numberOfLines={1}
                  >
                    {nextShow.venue.name}
                  </AppText>
                </View>
              ) : null}

              {nextSetlistLabel ? (
                <View style={styles.heroChip}>
                  <ListIcon size={12} color={Theme.colors.onPrimary} />
                  <AppText variant="caption" tone="inverse" numberOfLines={1}>
                    {nextSetlistLabel}
                  </AppText>
                </View>
              ) : null}
            </View>

            <ChevronRightIcon size={18} color={Theme.colors.onPrimary} />
          </LinearGradient>
        </Pressable>
      ) : (
        <Card style={styles.heroEmpty}>
          <View style={styles.heroEmptyTop}>
            <View style={styles.heroEmptyIcon}>
              <CalendarIcon size={20} color={Theme.colors.primary} />
            </View>
            <View style={styles.flex}>
              <AppText variant="subheading" numberOfLines={2}>
                {t("dashboard.noGig")}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={2}>
                {isAdmin ? t("dashboard.noGigAdmin") : t("dashboard.noGigMember")}
              </AppText>
            </View>
          </View>
          {isAdmin ? (
            <Button
              label={t("dashboard.bookGig")}
              variant="secondary"
              icon={<PlusIcon size={15} color={Theme.colors.text} />}
              onPress={() => router.push("/performances/new")}
              full
            />
          ) : null}
        </Card>
      )}

      <Card padded={false} style={styles.metrics}>
        {metrics.map((metric, index) => (
          <Pressable
            key={metric.key}
            onPress={() => router.push(metric.href as never)}
            accessibilityRole="button"
            accessibilityLabel={`${metric.label}: ${metric.value}`}
            style={({ pressed }) => [
              styles.metric,
              index > 0 && styles.metricDivider,
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="heading">{metric.value}</AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {metric.label}
            </AppText>
          </Pressable>
        ))}
      </Card>

      <View style={styles.block}>
        <AppText variant="label" tone="faint" style={styles.blockLabel}>
          {t("dashboard.quickActions")}
        </AppText>
        <View style={styles.actions}>
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Pressable
                key={action.key}
                onPress={() => router.push(action.href as never)}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.actionIcon}>
                  <Icon size={20} color={Theme.colors.primary} />
                </View>
                <AppText variant="caption" numberOfLines={2}>
                  {action.label}
                </AppText>
              </Pressable>
            )
          })}
        </View>
      </View>

      {isAdmin && pendingSuggestions.length > 0 ? (
        <Pressable
          onPress={() => router.push("/suggestions")}
          accessibilityRole="button"
          accessibilityLabel={`${t("dashboard.suggestionsTitle")}. ${pendingSuggestions.length}`}
          style={({ pressed }) => [styles.review, pressed && styles.pressed]}
        >
          <View style={styles.reviewIcon}>
            <ChatIcon size={18} color={Theme.colors.accent} />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {t("dashboard.suggestionsTitle")}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {t("dashboard.suggestionsSubtitle")}
            </AppText>
          </View>
          <Badge label={`${pendingSuggestions.length}`} tone="accent" />
          <ChevronRightIcon size={16} color={Theme.colors.textFaint} />
        </Pressable>
      ) : null}

      <View style={styles.blocks}>
        <View style={styles.block}>
          <Section
            title={t("dashboard.comingUp")}
            action={
              <Button
                label={t("dashboard.viewCalendar")}
                size="sm"
                variant="ghost"
                onPress={() => router.push("/calendar")}
              />
            }
          >
            {upcoming.length > 1 ? (
              <View style={styles.list}>
                {upcoming.slice(1).map((performance) => (
                  <Card
                    key={performance.id}
                    onPress={() =>
                      router.push(`/performances/${performance.id}`)
                    }
                    accessibilityLabel={`${performance.name}, ${formatRelativeDay(
                      parseIsoDate(performance.date),
                      dayLabels,
                    )}`}
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
                        {performance.endDate
                          ? formatDateRange(
                              performance.date,
                              performance.endDate,
                              i18n.language,
                            )
                          : formatRelativeDay(
                              parseIsoDate(performance.date),
                              dayLabels,
                            )}
                        {performance.startTime
                          ? ` · ${formatTime(performance.startTime)}`
                          : ""}
                        {performance.venue.name
                          ? ` · ${performance.venue.name}`
                          : ""}
                      </AppText>
                    </View>
                    <ChevronRightIcon
                      size={16}
                      color={Theme.colors.textFaint}
                    />
                  </Card>
                ))}
              </View>
            ) : (
              <Card>
                <AppText variant="caption" tone="faint">
                  {t("dashboard.noUpcomingGigsDescription")}
                </AppText>
              </Card>
            )}
          </Section>
        </View>

        <View style={styles.block}>
          <Section
            title={t("dashboard.recentlyUpdated")}
            action={
              <Button
                label={t("dashboard.allSongs")}
                size="sm"
                variant="ghost"
                onPress={() => router.push("/songs")}
              />
            }
          >
            {loading ? (
              <SkeletonList count={2} height={72} />
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
                  <SongRow
                    key={song.id}
                    song={song}
                    onPress={() => router.push(`/songs/${song.id}`)}
                  />
                ))}
              </View>
            )}
          </Section>
        </View>

        <View style={styles.block}>
          <Section title={t("dashboard.bandActivity")}>
            {activity.length === 0 ? (
              <Card>
                <AppText variant="caption" tone="faint">
                  {t("dashboard.noRecentActivityDescription")}
                </AppText>
              </Card>
            ) : (
              <Card style={styles.activityList}>
                {activity.slice(0, MAX_ACTIVITY).map((event) => (
                  <View key={event.id} style={styles.activityRow}>
                    <View style={styles.activityDot} />
                    <AppText
                      variant="caption"
                      tone="muted"
                      numberOfLines={2}
                      style={styles.flex}
                    >
                      {event.message}
                    </AppText>
                  </View>
                ))}
              </Card>
            )}
          </Section>
        </View>
      </View>
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.8 },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.m,
    },
    account: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      flex: 1,
      minWidth: 0,
      paddingVertical: 2,
      borderRadius: Theme.radii.pill,
    },
    accountName: { flexShrink: 1 },

    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      padding: Theme.spacing.l,
      borderRadius: Theme.radii.xl,
      ...Theme.shadows.md,
    },
    heroStamp: {
      minWidth: 62,
      paddingVertical: Theme.spacing.s,
      borderRadius: Theme.radii.lg,
      backgroundColor: colorWithOpacity("#FFFFFF", 0.24),
      alignItems: "center",
      gap: 1,
    },
    heroBody: { flex: 1, minWidth: 0, gap: 4 },
    heroTitle: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
    },
    heroStatus: {
      paddingHorizontal: Theme.spacing.s,
      paddingVertical: 3,
      borderRadius: Theme.radii.pill,
      backgroundColor: colorWithOpacity("#FFFFFF", 0.24),
      maxWidth: 130,
    },
    heroMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minWidth: 0,
    },
    heroMetaText: {
      color: colorWithOpacity(Theme.colors.onPrimary, 0.82),
      flexShrink: 1,
    },
    heroChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "flex-start",
      paddingHorizontal: Theme.spacing.s,
      paddingVertical: 3,
      borderRadius: Theme.radii.pill,
      backgroundColor: colorWithOpacity("#FFFFFF", 0.2),
    },
    heroEmpty: {
      gap: Theme.spacing.l,
    },
    heroEmptyTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
    },
    heroEmptyIcon: {
      width: 44,
      height: 44,
      borderRadius: Theme.radii.lg,
      backgroundColor: Theme.colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },

    metrics: { flexDirection: "row", overflow: "hidden" },
    metric: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 2,
      paddingVertical: Theme.spacing.l,
      paddingHorizontal: 4,
    },
    metricDivider: {
      borderLeftWidth: 1,
      borderLeftColor: Theme.colors.borderSoft,
    },

    block: { flexGrow: 1, flexBasis: 300, minWidth: 0, gap: Theme.spacing.m },
    blockLabel: { paddingLeft: Theme.spacing.xs },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.m },
    action: {
      flexGrow: 1,
      flexBasis: 140,
      minHeight: 96,
      gap: Theme.spacing.s,
      padding: Theme.spacing.m,
      borderRadius: Theme.radii.xl,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.surface,
      ...Theme.shadows.sm,
    },
    actionIcon: {
      width: 36,
      height: 36,
      borderRadius: Theme.radii.m,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.primarySoft,
    },

    review: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      padding: Theme.spacing.l,
      borderRadius: Theme.radii.xl,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.accentSoft,
    },
    reviewIcon: {
      width: 38,
      height: 38,
      borderRadius: Theme.radii.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.surface,
    },

    blocks: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.xl },
    list: { gap: Theme.spacing.m },
    showCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
    },
    stampSmall: {
      width: 36,
      height: 36,
      borderRadius: Theme.radii.m,
      backgroundColor: Theme.colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    activityList: { gap: Theme.spacing.m },
    activityRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Theme.spacing.s,
    },
    activityDot: {
      width: 7,
      height: 7,
      marginTop: 5,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.primary,
    },

    features: { gap: Theme.spacing.m },
    feature: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
    },
    featureIcon: {
      width: 40,
      height: 40,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.surfaceHigh,
      alignItems: "center",
      justifyContent: "center",
    },
    setupActions: { gap: Theme.spacing.s },
  })

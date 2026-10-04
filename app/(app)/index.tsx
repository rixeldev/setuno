import React, { useMemo, type ComponentType } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

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
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { StatRow, StatTile } from "@/components/app/StatTile"
import { SongRow } from "@/components/app/SongRow"
import { PERFORMANCE_STATUS_TONES } from "@/components/performances/PerformanceCard"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { PERFORMANCE_STATUS_LABELS } from "@/interfaces"
import {
  dayStamp,
  formatRelativeDay,
  formatShortDate,
  formatTime,
  pluralize,
} from "@/libs/format"
import { parseIsoDate } from "@/libs/validation"

const MAX_RECENT_SONGS = 4
const MAX_UPCOMING = 3

interface StarterFeature {
  icon: ComponentType<{ size?: number; color?: string }>
  title: string
  text: string
}

/** What Stage Book does, shown to people who don't belong to a band yet. */
const STARTER_FEATURES: StarterFeature[] = [
  { icon: MusicIcon, title: "Songbook", text: "Lyrics and chords, transposed on stage" },
  { icon: ListIcon, title: "Setlists", text: "Running orders you reuse for every gig" },
  { icon: CalendarIcon, title: "Gigs", text: "Dates, venues and who is playing" },
]

/**
 * Dashboard: what the band needs right now (docs §17) — the next show, the
 * counts that matter, pending suggestions and the latest changes.
 */
export default function Dashboard() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
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
  const today = useMemo(() => formatShortDate(new Date()), [])
  const firstName = profile?.displayName?.split(" ")[0] || "there"

  if (error) {
    return (
      <ScreenContainer title="Dashboard">
        <ErrorState message={error} />
      </ScreenContainer>
    )
  }

  // Accounts are not tied to a band: a new user lands here and decides later
  // whether to lead a band or wait for an invitation (docs §7).
  if (state === "needs-organization") {
    return (
      <ScreenContainer
        title={`Hey ${firstName}`}
        subtitle={`Welcome · ${today}`}
        large
        toolbar={
          <AppText variant="body" tone="muted">
            Nothing to set up right now — the rest of the app stays open while you decide.
          </AppText>
        }
      >
        <Card style={styles.welcome}>
          <View style={styles.welcomeIcon}>
            <MusicIcon size={24} color={Theme.colors.primary} />
          </View>
          <AppText variant="subheading">Your account is ready</AppText>
          <AppText variant="body" tone="muted">
            Stage Book keeps the songbook, setlists and gigs for each band. Create yours whenever
            you want, or join one with an invitation.
          </AppText>
          <View style={styles.welcomeActions}>
            <Button label="Create a band" onPress={() => router.push("/organizations/new")} />
            <Button
              label="Bands and invitations"
              variant="secondary"
              onPress={() => router.push("/organizations")}
            />
          </View>
        </Card>

        <View style={styles.featureList}>
          {STARTER_FEATURES.map((feature) => {
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
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer
      title={`Hey ${firstName}`}
      subtitle={organization ? `${organization.name} · ${today}` : today}
      large
      headerRight={
        isAdmin ? (
          <IconButton
            label="Add a song"
            variant="secondary"
            onPress={() => router.push("/songs/new")}
            icon={<PlusIcon size={18} color={Theme.colors.primary} />}
          />
        ) : null
      }
      toolbar={
        <View style={styles.quick}>
          <AppText variant="caption" tone="muted">
            {role === "admin"
              ? "You can edit songs, setlists and gigs."
              : "You can suggest changes to songs."}
          </AppText>
          <View style={styles.quickActions}>
            {isAdmin ? (
              <>
                <Button
                  label="New song"
                  size="sm"
                  variant="secondary"
                  icon={<PlusIcon size={15} color={Theme.colors.text} />}
                  onPress={() => router.push("/songs/new")}
                />
                <Button
                  label="New setlist"
                  size="sm"
                  variant="secondary"
                  icon={<ListIcon size={15} color={Theme.colors.text} />}
                  onPress={() => router.push("/setlists/new")}
                />
                <Button
                  label="Schedule gig"
                  size="sm"
                  variant="secondary"
                  icon={<CalendarIcon size={15} color={Theme.colors.text} />}
                  onPress={() => router.push("/performances/new")}
                />
              </>
            ) : (
              <Button
                label="Open songbook"
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
          accessibilityLabel={`${nextShow.name}, ${formatRelativeDay(parseIsoDate(nextShow.date))}`}
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
                label={PERFORMANCE_STATUS_LABELS[nextShow.status]}
                tone={PERFORMANCE_STATUS_TONES[nextShow.status]}
              />
            </View>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {[
                formatRelativeDay(parseIsoDate(nextShow.date)),
                nextShow.startTime ? formatTime(nextShow.startTime) : null,
                nextShow.venue.name,
              ]
                .filter(Boolean)
                .join(" · ") || "No time or venue yet"}
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
            <AppText variant="bodyStrong">Nothing booked yet</AppText>
            <AppText variant="caption" tone="muted">
              {isAdmin
                ? "Add a gig or a rehearsal and it shows up here."
                : "Your band hasn't scheduled a gig yet."}
            </AppText>
          </View>
          {isAdmin ? (
            <Button
              label="Plan a gig"
              size="sm"
              variant="secondary"
              onPress={() => router.push("/performances/new")}
            />
          ) : null}
        </Card>
      )}

      <StatRow>
        <StatTile
          label="Songs"
          value={loading ? "—" : stats.songs}
          hint={loading ? "Loading" : pluralize(stats.chords, "chord")}
          icon={MusicIcon}
          tone="primary"
          onPress={() => router.push("/songs")}
        />
        <StatTile
          label="Setlists"
          value={setlists.length}
          hint={setlists.length > 0 ? "Reusable running orders" : "None yet"}
          icon={ListIcon}
          onPress={() => router.push("/setlists")}
        />
        <StatTile
          label="Upcoming"
          value={upcomingPerformances.length}
          hint={nextShow ? formatRelativeDay(parseIsoDate(nextShow.date)) : "Nothing booked"}
          icon={CalendarIcon}
          onPress={() => router.push("/performances")}
        />
        <StatTile
          label="Members"
          value={members.length}
          hint={isAdmin ? "You are the admin" : "Band members"}
          icon={UsersIcon}
          onPress={() => router.push("/members")}
        />
      </StatRow>

      {isAdmin && pendingSuggestions.length > 0 ? (
        <Section
          title="Suggestions waiting for you"
          subtitle="Only admins can approve chord changes"
          action={
            <Button label="Review" size="sm" variant="secondary" onPress={() => router.push("/suggestions")} />
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
                <Badge label="Pending" tone="warning" />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section
        title="Recently updated"
        subtitle={loading ? undefined : `${pluralize(songs.length, "song")} in this band`}
        action={<Button label="All songs" size="sm" variant="ghost" onPress={() => router.push("/songs")} />}
      >
        {loading ? (
          <SkeletonList count={3} height={78} />
        ) : recentSongs.length === 0 ? (
          <EmptyState
            compact
            title="No songs yet"
            message="Add the first song to your band's chord book."
            actionLabel={isAdmin ? "Add a song" : undefined}
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
          title="Coming up"
          action={<Button label="Calendar" size="sm" variant="ghost" onPress={() => router.push("/calendar")} />}
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
                    {formatRelativeDay(parseIsoDate(performance.date))}
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
        <Section title="Band activity">
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
    quick: { gap: Theme.spacing.s },
    quickActions: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.s },
    welcome: { gap: Theme.spacing.m, alignItems: "flex-start" },
    welcomeIcon: {
      width: 52,
      height: 52,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    welcomeActions: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.s },
    featureList: { gap: Theme.spacing.s },
    feature: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    featureIcon: {
      width: 38,
      height: 38,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.surfaceHigh,
      alignItems: "center",
      justifyContent: "center",
    },
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

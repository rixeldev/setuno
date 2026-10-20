import React, { useMemo, useRef, useState } from "react"
import { StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { useTranslation } from "react-i18next"
import ViewShot, { type ViewShotRef } from "react-native-view-shot"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card, Chip, Section } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import {
  ChevronDownIcon,
  FlameIcon,
  MusicIcon,
  ShareIcon,
  StopwatchIcon,
  TrophyIcon,
} from "@/components/ui/Icons"
import { Avatar } from "@/components/ui/Avatar"
import { StatRow, StatTile } from "@/components/app/StatTile"
import { ModalScreen } from "@/components/app/ModalScreen"
import { YearRecapCard } from "@/components/stats/YearRecapCard"
import { captureAndShareImage } from "@/libs/shareImage"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { useEntitlement } from "@/hooks/useEntitlement"
import {
  buildBandStats,
  buildYearRecap,
  defaultRecapYear,
  recapFileName,
  recapYears,
  type MemberActivity,
} from "@/libs/bandStats"

/** Rows of the "Top songs" ranking before the list gives way to the card. */
const MAX_TOP_SONGS = 5

/**
 * Band stats and the year-in-review card (roadmap #35): every number is
 * derived here from the collections the shell already subscribes to — no new
 * listener, nothing stored. The card is captured straight off the screen
 * (native screenshot / html2canvas on the web) and handed to the share sheet
 * or the browser's download, one seam in `libs/shareImage`.
 */
export default function BandStatsScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const toast = useToast()
  const { organization } = useOrganization()
  const { performances, setlists, songs, members, loading, error } = useOrgData()
  const plan = useEntitlement()

  const [year, setYear] = useState<number | null>(null)
  const [yearSheetOpen, setYearSheetOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const shotRef = useRef<ViewShotRef | null>(null)

  const years = useMemo(() => recapYears(performances, songs), [performances, songs])
  const defaultYear = useMemo(
    () => defaultRecapYear(performances, setlists, songs),
    [performances, setlists, songs],
  )
  const activeYear = year ?? defaultYear
  const recap = useMemo(
    () => buildYearRecap(performances, setlists, songs, activeYear),
    [performances, setlists, songs, activeYear],
  )
  const stats = useMemo(
    () => buildBandStats(performances, setlists, songs, members),
    [performances, setlists, songs, members],
  )

  /** "45 min" / "2 h" / "2 h 15 min" — the tiles' value line. */
  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) return t("stats.minutesValue", { minutes })
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest === 0
      ? t("stats.hoursOnly", { hours })
      : t("stats.hoursMinutes", { hours, minutes: rest })
  }

  const share = async (): Promise<void> => {
    setSharing(true)
    try {
      const fileName = recapFileName(organization?.name ?? "", activeYear)
      const ok = await captureAndShareImage(shotRef, {
        fileName,
        dialogTitle: t("stats.shareCard"),
      })
      if (!ok) toast.showError(t("stats.shareFailed"))
    } catch {
      toast.showError(t("stats.shareFailed"))
    } finally {
      setSharing(false)
    }
  }

  /** "3 songs · 1 setlist · 2 events" — each part pluralised on its own. */
  const memberLine = (activity: MemberActivity): string =>
    [
      t("stats.nSongs", { count: activity.songs }),
      t("stats.nSets", { count: activity.setlists }),
      t("stats.nEvents", { count: activity.events }),
    ].join(" · ")

  const bandName = organization?.name || t("stats.yourBand")
  const topSongs = stats.topSongs.slice(0, MAX_TOP_SONGS)

  // The band's statistics are a Pro perk (roadmap #61): a free member sees the
  // upsell instead of the numbers, and the reading itself is never gated.
  if (!plan.isPro) {
    return (
      <ModalScreen title={t("stats.title")} subtitle={t("stats.subtitle")}>
        <Card>
          <AppText variant="body" tone="muted">
            {t("plan.statsLocked")}
          </AppText>
          <Button
            label={t("plan.seePlan")}
            onPress={() => router.push("/settings/plan")}
          />
        </Card>
      </ModalScreen>
    )
  }

  return (
    <ModalScreen title={t("stats.title")} subtitle={t("stats.subtitle")}>
      {error ? <ErrorState message={error} /> : null}

      {loading ? (
        <SkeletonList count={3} height={88} />
      ) : (
        <>
          <Section title={t("stats.overview")}>
            <StatRow>
              <StatTile
                label={t("stats.lblShows")}
                value={stats.showsPlayed}
                icon={TrophyIcon}
              />
              <StatTile
                label={t("stats.lblSongsPlayed")}
                value={stats.songsPlayed}
                icon={MusicIcon}
              />
              <StatTile
                label={t("stats.lblAvgSet")}
                value={
                  stats.averageSetMinutes === null
                    ? "—"
                    : formatMinutes(stats.averageSetMinutes)
                }
                hint={
                  stats.averageSetMinutes === null
                    ? undefined
                    : t("stats.avgSetHint", { count: stats.setlistsAveraged })
                }
                icon={StopwatchIcon}
              />
              <StatTile
                label={t("stats.lblTimePlayed")}
                value={formatMinutes(stats.musicMinutes)}
                icon={FlameIcon}
              />
            </StatRow>
          </Section>

          <Section title={t("stats.topSongs")}>
            {topSongs.length === 0 ? (
              <EmptyState
                compact
                title={t("stats.noPlays")}
                message={t("stats.noPlaysHint")}
              />
            ) : (
              <View style={styles.list}>
                {topSongs.map((song, index) => (
                  <Card
                    key={song.id}
                    onPress={() => router.push(`/songs/${song.id}`)}
                    accessibilityLabel={`${song.title}${song.artist ? `, ${song.artist}` : ""}. ${t(
                      "stats.playedCount",
                      { count: song.timesPlayed },
                    )}`}
                    style={styles.songRow}
                  >
                    <AppText variant="label" tone="faint" style={styles.rank}>
                      {index + 1}
                    </AppText>
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {song.title}
                      </AppText>
                      {song.artist ? (
                        <AppText variant="caption" tone="muted" numberOfLines={1}>
                          {song.artist}
                        </AppText>
                      ) : null}
                    </View>
                    <Badge label={`${song.timesPlayed}×`} tone="primary" />
                  </Card>
                ))}
              </View>
            )}
          </Section>

          <Section
            title={t("stats.yearRecap")}
            action={
              years.length > 1 ? (
                <Chip
                  label={String(activeYear)}
                  onPress={() => setYearSheetOpen(true)}
                  icon={<ChevronDownIcon size={14} color={Theme.colors.textMuted} />}
                  accessibilityLabel={t("stats.pickYear")}
                />
              ) : undefined
            }
          >
            {/* The capture target: everything the shared PNG shows lives inside. */}
            <ViewShot ref={shotRef}>
              <YearRecapCard bandName={bandName} year={activeYear} recap={recap} />
            </ViewShot>
            <Button
              label={t("stats.shareCard")}
              variant="secondary"
              icon={<ShareIcon size={16} color={Theme.colors.text} />}
              onPress={() => void share()}
              loading={sharing}
              disabled={sharing}
              full
            />
            <BottomSheet
              visible={yearSheetOpen}
              onClose={() => setYearSheetOpen(false)}
              title={t("stats.pickYear")}
            >
              {years.map((option) => (
                <SheetOptionRow
                  key={option}
                  label={String(option)}
                  selected={option === activeYear}
                  onPress={() => {
                    setYear(option)
                    setYearSheetOpen(false)
                  }}
                />
              ))}
            </BottomSheet>
          </Section>

          <Section title={t("stats.memberActivity")}>
            {stats.memberActivity.length === 0 ? (
              <EmptyState
                compact
                title={t("organizations.noMembers")}
                message={t("members.noMembersViewer")}
              />
            ) : (
              <Card padded={false}>
                {stats.memberActivity.map((activity, index) => (
                  <View
                    key={activity.uid}
                    style={[styles.memberRow, index > 0 && styles.divider]}
                  >
                    <Avatar
                      photoURL={activity.photoURL}
                      name={activity.displayName}
                      size={36}
                    />
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {activity.displayName}
                      </AppText>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>
                        {memberLine(activity)}
                      </AppText>
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </Section>
        </>
      )}
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    list: { gap: Theme.spacing.m },
    songRow: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    rank: { width: 20, textAlign: "center" },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      padding: Theme.spacing.m,
    },
    divider: {
      borderTopWidth: 1,
      borderTopColor: Theme.colors.borderSoft,
    },
  })

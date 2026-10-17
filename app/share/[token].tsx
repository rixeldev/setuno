import React, { useEffect, useState } from "react"
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useResponsive } from "@/hooks/useResponsive"
import { AppText } from "@/components/ui/AppText"
import { PageHeader } from "@/components/ui/PageHeader"
import { EmptyState, ErrorState } from "@/components/ui/States"
import { SongContent } from "@/components/songs/SongContent"
import { displayKey } from "@/libs/chords"
import { formatDate } from "@/libs/format"
import {
  LIVE_FRESH_WINDOW_MS,
  shareLiveFreshness,
  sharedSections,
  sharedSetlistRows,
  type ShareLiveFreshness,
} from "@/libs/shareView"
import { usePreferences } from "@/services/prefs"
import { subscribeShare, type FetchedShare } from "@/services/shares"
import type { SharedSetlistPayload, SharedSongPayload } from "@/functions/src/shares"

type Phase = "loading" | "ready" | "gone" | "failed"

/** `yyyy-mm-dd` renders as a readable date; anything else rides through as-is. */
const dateText = (date: string): string =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatDate(new Date(date)) : date

/**
 * The share link itself (roadmap #56): a read-only public page, deliberately
 * outside the `(auth)` and `(app)` groups so a signed-out visitor lands here
 * without bouncing through sign-in. It renders what the share document
 * carries — the snapshot the `createShare` callable froze, plus (roadmap
 * #57) the "current position" the band's clients keep fresh while the show
 * runs. The page subscribes by exact token: a static share never changes
 * again, while a live setlist moves under the open page. A revoked or expired
 * link degrades to the "no longer available" state the rules enforce (the
 * document is gone, or the read was denied), and a position nobody has
 * touched for 90 minutes stops calling itself live and settles into "this is
 * how the night ran".
 */
export default function ShareScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>()
  const tokenValue = Array.isArray(params.token) ? params.token[0] : params.token
  const token = typeof tokenValue === "string" ? tokenValue : ""

  const { t } = useTranslation()
  const prefs = usePreferences()
  const { isMobile, contentMaxWidth } = useResponsive()
  const styles = useThemedStyles(createStyles)

  const [phase, setPhase] = useState<Phase>("loading")
  const [attempt, setAttempt] = useState(0)
  const [share, setShare] = useState<FetchedShare | null>(null)
  // Freshness of the live position (roadmap #57): decided when a snapshot
  // arrives, then flipped by a timer — the wall clock never runs during
  // render, and a position nobody touches must settle into "the night ran"
  // even though no further snapshot will ever arrive.
  const [liveStale, setLiveStale] = useState(false)

  // One document listener per open page: the denied error the rules answer an
  // expired link with already collapses to `null` inside the service, so this
  // screen sees a single "gone" state and only real failures reach `failed`.
  useEffect(() => {
    if (!token) return
    return subscribeShare(
      token,
      (result) => {
        setShare(result)
        setPhase(result ? "ready" : "gone")
        const live = result?.live ?? null
        setLiveStale(live !== null && shareLiveFreshness(live, Date.now()) === "stale")
      },
      () => setPhase("failed"),
    )
  }, [token, attempt])

  // The show's own deadline: once the window runs out, the banner flips to
  // "last song" on its own (timers live in effects — never in render).
  useEffect(() => {
    const live = share?.live
    if (!live) return
    const delay = Math.max(0, live.updatedAt + LIVE_FRESH_WINDOW_MS - Date.now())
    const timeout = setTimeout(() => setLiveStale(true), delay)
    return () => clearTimeout(timeout)
  }, [share?.live])

  const retry = () => {
    setPhase("loading")
    setAttempt((value) => value + 1)
  }

  const headerTitle = share?.title || t("shares.title")
  const displayPhase: Phase = token ? phase : "gone"

  if (displayPhase === "loading") {
    return (
      <View style={styles.screen}>
        <PageHeader title={headerTitle} />
        <View style={styles.centered}>
          <ActivityIndicator color={Theme.colors.primary} />
          <AppText variant="caption" tone="muted">
            {t("common.loading")}
          </AppText>
        </View>
      </View>
    )
  }

  if (displayPhase === "gone") {
    return (
      <View style={styles.screen}>
        <PageHeader title={headerTitle} />
        <View style={styles.centered}>
          <EmptyState title={t("shares.goneTitle")} message={t("shares.goneMessage")} />
        </View>
      </View>
    )
  }

  if (displayPhase === "failed") {
    return (
      <View style={styles.screen}>
        <PageHeader title={headerTitle} />
        <View style={styles.centered}>
          <ErrorState title={t("shares.errorTitle")} message={t("shares.errorMessage")} onRetry={retry} />
        </View>
      </View>
    )
  }

  if (!share) return null

  const song = share.kind === "song" ? (share.payload as SharedSongPayload) : null
  const setlist = share.kind === "setlist" ? (share.payload as SharedSetlistPayload) : null

  // Live position (roadmap #57): only a setlist link can carry one (the rules
  // allow the field, the reader only ever writes it while walking a setlist),
  // and a song the band since removed from the snapshot degrades to the
  // position alone rather than highlighting the wrong row.
  const live = setlist ? share.live : null
  const liveFreshness: ShareLiveFreshness = liveStale ? "stale" : "current"
  const currentEntry =
    live && setlist ? (setlist.entries.find((entry) => entry.songId === live.songId) ?? null) : null
  const shownPosition =
    live && setlist ? Math.min(live.position, Math.max(setlist.entries.length, 1)) : 0

  const songMeta = song
    ? [
        song.artist,
        song.key ? displayKey(song.key, prefs.chordNotation) : "",
        song.capo > 0 ? `${t("songs.capo")} ${song.capo}` : "",
        song.bpm ? `${song.bpm} BPM` : "",
      ].filter((part) => part.length > 0)
    : []

  return (
    <View style={styles.screen}>
      <PageHeader title={headerTitle} />
      <ScrollView contentContainerStyle={[styles.body, { maxWidth: contentMaxWidth }]}>
        {song ? (
          <>
            {songMeta.length > 0 ? (
              <AppText variant="caption" tone="muted">
                {songMeta.join(" · ")}
              </AppText>
            ) : null}
            <SongContent
              sections={sharedSections(song.sections)}
              fontSize={prefs.songFontSize}
              view={prefs.chordView}
              songKey={song.key}
              notation={prefs.chordNotation}
              columns={isMobile ? 1 : 2}
            />
          </>
        ) : null}

        {setlist ? (
          <>
            {/* Roadmap #57: the live banner is the page's hero while the show
                runs — the current song and where in the set it sits. Once the
                position goes stale the same block settles into the night that
                ran, so a forgotten toggle never pretends a song just started. */}
            {live ? (
              <View
                style={[styles.liveBanner, liveFreshness === "stale" ? styles.liveBannerStale : null]}
              >
                <View style={styles.liveBannerTop}>
                  <AppText variant="label" tone={liveFreshness === "current" ? "primary" : "muted"}>
                    {liveFreshness === "current"
                      ? t("shares.liveBadge")
                      : t("shares.liveEndedBadge")}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {t("shares.livePosition", {
                      position: shownPosition,
                      total: setlist.entries.length,
                    })}
                  </AppText>
                </View>
                {currentEntry ? (
                  <AppText variant="title" numberOfLines={2}>
                    {currentEntry.title}
                  </AppText>
                ) : null}
                <AppText variant="caption" tone={liveFreshness === "current" ? "primary" : "faint"}>
                  {liveFreshness === "current"
                    ? t("shares.liveNowPlaying")
                    : t("shares.liveEndedCaption")}
                </AppText>
              </View>
            ) : null}
            {setlist.date ? (
              <AppText variant="caption" tone="muted">
                {dateText(setlist.date)}
              </AppText>
            ) : null}
            {sharedSetlistRows(setlist).map((row, index) =>
              row.kind === "divider" ? (
                <View key={`divider-${index}`} style={styles.divider}>
                  <AppText variant="caption" tone="primary">
                    {row.name}
                  </AppText>
                  <View style={styles.dividerLine} />
                </View>
              ) : (
                <View
                  key={`song-${index}`}
                  style={[styles.entry, live?.songId === row.entry.songId ? styles.entryCurrent : null]}
                >
                  <AppText
                    variant="caption"
                    tone={live?.songId === row.entry.songId ? "primary" : "faint"}
                    style={styles.entryIndex}
                  >
                    {row.index}
                  </AppText>
                  <View style={styles.entryBody}>
                    <AppText variant="bodyStrong">{row.entry.title}</AppText>
                    {row.entry.artist ? (
                      <AppText variant="caption" tone="muted">
                        {row.entry.artist}
                      </AppText>
                    ) : null}
                    {row.entry.note ? (
                      <AppText variant="caption" tone="faint">
                        {row.entry.note}
                      </AppText>
                    ) : null}
                  </View>
                  {row.entry.key ? (
                    <AppText variant="caption" tone="primary">
                      {displayKey(row.entry.key, prefs.chordNotation)}
                    </AppText>
                  ) : null}
                </View>
              ),
            )}
          </>
        ) : null}

        <AppText variant="caption" tone="faint" style={styles.brand}>
          {t("common.appName")}
        </AppText>
      </ScrollView>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Theme.colors.background },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: Theme.spacing.m,
      padding: Theme.spacing.xl,
    },
    body: {
      alignSelf: "center",
      width: "100%",
      flexGrow: 1,
      padding: Theme.spacing.l,
      paddingTop: Theme.spacing.m,
      paddingBottom: Theme.spacing.xxl,
      gap: Theme.spacing.m,
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      marginTop: Theme.spacing.s,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: Theme.colors.borderSoft },
    entry: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.s,
      borderBottomWidth: 1,
      borderBottomColor: Theme.colors.borderSoft,
    },
    entryIndex: { width: 22, textAlign: "right" },
    entryBody: { flex: 1, gap: 2, minWidth: 0 },
    // Roadmap #57: the live banner and the row the band is playing right now.
    liveBanner: {
      gap: Theme.spacing.xs,
      padding: Theme.spacing.m,
      borderRadius: Theme.radii.m,
      borderWidth: 1,
      borderColor: Theme.colors.primary,
      backgroundColor: Theme.colors.primarySoft,
    },
    liveBannerStale: {
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.surfaceMuted,
    },
    liveBannerTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.s,
    },
    entryCurrent: {
      backgroundColor: Theme.colors.primarySoft,
      borderRadius: Theme.radii.s,
      paddingHorizontal: Theme.spacing.s,
    },
    brand: { marginTop: Theme.spacing.xl, textAlign: "center" },
  })

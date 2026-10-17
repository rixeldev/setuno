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
import { sharedSections, sharedSetlistRows } from "@/libs/shareView"
import { usePreferences } from "@/services/prefs"
import { fetchShare, type FetchedShare } from "@/services/shares"
import type { SharedSetlistPayload, SharedSongPayload } from "@/functions/src/shares"

type Phase = "loading" | "ready" | "gone" | "failed"

/** `yyyy-mm-dd` renders as a readable date; anything else rides through as-is. */
const dateText = (date: string): string =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatDate(new Date(date)) : date

/**
 * The share link itself (roadmap #56): a read-only public page, deliberately
 * outside the `(auth)` and `(app)` groups so a signed-out visitor lands here
 * without bouncing through sign-in. It renders the snapshot the `createShare`
 * callable froze — never live data — so nothing here subscribes, and a
 * revoked or expired link degrades to the "no longer available" state the
 * rules enforce (the document is gone, or the read was denied).
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

  useEffect(() => {
    if (!token) return
    let cancelled = false
    void (async () => {
      try {
        const result = await fetchShare(token)
        if (cancelled) return
        setShare(result)
        setPhase(result ? "ready" : "gone")
      } catch {
        if (cancelled) return
        setPhase("failed")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, attempt])

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
                <View key={`song-${index}`} style={styles.entry}>
                  <AppText variant="caption" tone="faint" style={styles.entryIndex}>
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
    brand: { marginTop: Theme.spacing.xl, textAlign: "center" },
  })

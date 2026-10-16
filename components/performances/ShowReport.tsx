import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useOrgData } from "@/hooks/useOrgData"
import { AppText } from "@/components/ui/AppText"
import { Card, Chip } from "@/components/ui/Card"
import { IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { EmptyState, Skeleton } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { ShowOutcomeSheet } from "@/components/performances/ShowOutcomeSheet"
import { PencilIcon, TargetIcon } from "@/components/ui/Icons"
import { saveShowLog } from "@/services/performances"
import { toFriendlyError } from "@/services/errors"
import { formatDuration, formatDurationLong } from "@/libs/format"
import { formatClock } from "@/libs/liveShow"
import { buildShowReport, markShowOutcome, replaceShowNote } from "@/libs/showLog"
import { SHOW_OUTCOME_KEYS } from "@/interfaces/performance"
import type { ShowReportRow } from "@/libs/showLog"
import type { ShowLogEntry } from "@/interfaces/performance"

/** Stable empty log for events that never had one. */
const EMPTY_LOG: ShowLogEntry[] = []
/** Synthetic group id for logged songs no attached list contains anymore. */
const ORPHAN_GROUP = "orphan"

/**
 * Post-gig report (roadmap #45): the show log, reviewed song by song — the
 * running order of every attached setlist with the real clock beside the
 * estimate, a mark per song and a note per row.
 *
 * Edits are **write-through**: each mark and each saved note is the whole
 * current log through `saveShowLog`, so there is no draft to lose on the way
 * out (and no focus-route chrome). A local copy tagged with the event id takes
 * over the moment this screen changes anything, mirroring the reader's session
 * pattern, and the stored snapshot keeps flowing underneath for every other
 * viewer. The live reader keeps syncing while a show runs — mark from the
 * strip during the show, correct here afterwards.
 */
export function ShowReport() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const params = useLocalSearchParams<{ id?: string }>()
  const performanceId = params.id ?? null

  const { performances, setlists, songLibrary, loading } = useOrgData()
  const performance = useMemo(
    () => performances.find((entry) => entry.id === performanceId) ?? null,
    [performances, performanceId],
  )

  const storedLog = performance?.showLog ?? EMPTY_LOG
  const [draft, setDraft] = useState<{ id: string; entries: ShowLogEntry[] } | null>(null)
  // Tagged with the event id exactly like `useReaderState`: switching events
  // must read the other event's stored log, never this screen's draft.
  const log = draft && draft.id === performanceId ? draft.entries : storedLog

  const report = useMemo(() => {
    if (!performance) return null
    const durationFor = (songId: string): number | null =>
      songLibrary.get(songId)?.durationSec ?? null
    const attached = performance.setlists.flatMap((reference) => {
      const list = setlists.find((entry) => entry.id === reference.id)
      return list
        ? [
            {
              id: list.id,
              name: list.name || reference.name,
              songs: list.songs.map((song) => ({ songId: song.songId, title: song.title })),
            },
          ]
        : []
    })
    const first = buildShowReport(attached, durationFor, log)
    // Songs the log still knows but no attached list contains anymore (the
    // list was edited after the show) get their own group — nothing the band
    // recorded may vanish from the review.
    const listed = new Set(first.groups.flatMap((group) => group.rows.map((row) => row.songId)))
    const orphans = log.flatMap((entry) =>
      listed.has(entry.songId)
        ? []
        : [{ songId: entry.songId, title: songLibrary.get(entry.songId)?.title ?? "" }],
    )
    if (orphans.length === 0) return first
    return buildShowReport(
      [...attached, { id: ORPHAN_GROUP, name: t("performances.reportOrphans"), songs: orphans }],
      durationFor,
      log,
    )
  }, [performance, setlists, songLibrary, log, t])

  const [sheetSong, setSheetSong] = useState<ShowReportRow | null>(null)
  const [noteDraft, setNoteDraft] = useState<{
    songId: string
    title: string
    value: string
  } | null>(null)

  const applyEntries = (entries: ShowLogEntry[]): void => {
    if (!performance) return
    setDraft({ id: performance.id, entries })
    void saveShowLog(performance.organizationId, performance.id, entries).catch((error) => {
      toast.showError(toFriendlyError(error, t("performances.couldNotSaveLog")))
    })
  }

  if (!performanceId || !performance) {
    return (
      <ScreenContainer back title={t("performances.reportTitle")}>
        {loading ? <Skeleton height={200} /> : null}
        {!loading ? (
          <EmptyState
            title={t("performances.performanceNotFound")}
            message={t("performances.performanceNotFoundDescription")}
            actionLabel={t("performances.backToPerformances")}
            onAction={() => router.replace("/performances")}
          />
        ) : null}
      </ScreenContainer>
    )
  }

  if (!report || report.groups.length === 0) {
    return (
      <ScreenContainer back title={t("performances.reportTitle")}>
        <EmptyState
          icon={<TargetIcon size={40} color={Theme.colors.textFaint} />}
          title={t("performances.reportTitle")}
          message={t("performances.reportNoSetlist")}
        />
      </ScreenContainer>
    )
  }

  const totals = report.totals

  return (
    <ScreenContainer back title={t("performances.reportTitle")} subtitle={performance.name}>
      <Card>
        <AppText variant="label" tone="faint">
          {t("performances.reportSummary")}
        </AppText>
        <AppText variant="bodyStrong">
          {t("performances.reportCounts", {
            played: totals.played,
            skipped: totals.skipped,
            improvised: totals.improvised,
          })}
        </AppText>
        <AppText variant="caption" tone="muted">
          {t("performances.reportTimes", {
            real: formatDurationLong(totals.actualSec),
            estimate: formatDurationLong(totals.estimatedSec),
          })}
        </AppText>
        {totals.logged === 0 ? (
          <AppText variant="caption" tone="faint">
            {t("performances.reportEmpty")}
          </AppText>
        ) : null}
      </Card>

      {report.groups.map((group) => (
        <Card key={group.id}>
          <AppText variant="label" tone="faint">
            {group.name}
          </AppText>
          <View>
            {group.rows.map((row, index) => {
              const outcome = row.entry?.outcome ?? null
              const estimate =
                row.estimatedSec !== null && row.estimatedSec > 0
                  ? formatDuration(row.estimatedSec)
                  : "—"
              const real =
                row.actualSec !== null && row.actualSec > 0 ? formatDuration(row.actualSec) : "—"
              const deltaText =
                row.deltaSec === null
                  ? null
                  : row.deltaSec > 0
                    ? t("liveShow.behind", { time: formatClock(row.deltaSec) })
                    : t("liveShow.ahead", { time: formatClock(-row.deltaSec) })
              const title =
                row.title.trim().length > 0 ? row.title : t("performances.reportRemovedSong")
              return (
                <View key={row.songId} style={styles.row}>
                  <View style={styles.rowMain}>
                    <View style={styles.rowHead}>
                      <AppText variant="caption" tone="faint">
                        {index + 1}
                      </AppText>
                      <AppText variant="bodyStrong" numberOfLines={2} style={styles.flex}>
                        {title}
                      </AppText>
                      <Chip
                        size="sm"
                        tone={
                          outcome === "skipped"
                            ? "danger"
                            : outcome === "improvised"
                              ? "accent"
                              : "primary"
                        }
                        selected={outcome !== null}
                        label={
                          outcome
                            ? t(SHOW_OUTCOME_KEYS[outcome])
                            : t("performances.reportNotLogged")
                        }
                        onPress={() => setSheetSong(row)}
                      />
                    </View>
                    <AppText variant="caption" tone="muted">
                      {t("performances.reportRowTimes", { estimated: estimate, real })}
                      {deltaText ? ` · ${deltaText}` : ""}
                    </AppText>
                    {row.entry?.note ? (
                      <AppText variant="caption" tone="faint" numberOfLines={2}>
                        {row.entry.note}
                      </AppText>
                    ) : null}
                  </View>
                  <IconButton
                    label={`${t("performances.reportNoteTitle")} · ${title}`}
                    size={28}
                    onPress={() =>
                      setNoteDraft({ songId: row.songId, title, value: row.entry?.note ?? "" })
                    }
                    icon={<PencilIcon size={14} color={Theme.colors.textMuted} />}
                  />
                </View>
              )
            })}
          </View>
        </Card>
      ))}

      <ShowOutcomeSheet
        visible={sheetSong !== null}
        onClose={() => setSheetSong(null)}
        songTitle={sheetSong?.title ?? ""}
        outcome={sheetSong?.entry?.outcome ?? null}
        onSelect={(outcome) => {
          if (!sheetSong) return
          applyEntries(markShowOutcome(log, sheetSong.songId, outcome, Date.now()))
        }}
      />

      <Dialog
        visible={noteDraft !== null}
        onClose={() => setNoteDraft(null)}
        title={t("performances.reportNoteTitle")}
        confirmLabel={t("common.save")}
        onConfirm={() => {
          if (!noteDraft) return
          applyEntries(replaceShowNote(log, noteDraft.songId, noteDraft.value, Date.now()))
          setNoteDraft(null)
        }}
      >
        <AppText variant="caption" tone="muted" style={styles.noteFor}>
          {noteDraft?.title}
        </AppText>
        <Input
          value={noteDraft?.value ?? ""}
          onChangeText={(value) =>
            setNoteDraft((current) => (current ? { ...current, value } : current))
          }
          placeholder={t("performances.reportNotePlaceholder")}
          multiline
        />
      </Dialog>
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Theme.spacing.s,
      paddingVertical: Theme.spacing.s,
      borderTopWidth: 1,
      borderTopColor: Theme.colors.borderSoft,
    },
    rowMain: { flex: 1, minWidth: 0, gap: 2 },
    rowHead: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    flex: { flex: 1, minWidth: 0 },
    noteFor: { marginBottom: Theme.spacing.xs },
  })

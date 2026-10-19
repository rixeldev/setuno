import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { Redirect, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { useToast } from "@/components/ui/Toast"
import { ModalScreen } from "@/components/app/ModalScreen"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { extractChoFiles } from "@/libs/choZip"
import { pickImportFiles } from "@/libs/importFiles"
import {
  IMPORT_CAPS,
  emptyBandBackup,
  fileNameTitle,
  mergeBackups,
  parseBandBackup,
  parseChoSource,
  parseSongsCsv,
  planBackupImport,
  type BandBackup,
  type BandBackupSong,
  type ImportPlan,
} from "@/libs/bandBackup"
import { executeImportPlan, type ImportResult } from "@/services/bandBackup"
import { toFriendlyError } from "@/services/errors"

type Phase = "idle" | "parsing" | "preview" | "importing" | "done"

/**
 * Bulk import and backup restore (roadmap #38): one admin door for a Setuno
 * `.json` backup, a song `.csv`, a `.cho` document or a `.zip` of them. Every
 * file is parsed and planned in memory first (`libs/bandBackup.ts`), so the
 * screen can show exactly what would be created and what is already there
 * before a single write happens; confirming replays the plan through
 * `services/bandBackup.ts`.
 */
export default function ImportSongsScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { profile } = useAuth()
  const { organizationId, isAdmin } = useOrganization()
  const { songs, setlists, performances, songLibrary } = useOrgData()

  const [phase, setPhase] = useState<Phase>("idle")
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [invalidFiles, setInvalidFiles] = useState(0)
  const [skippedRows, setSkippedRows] = useState<number[]>([])
  const [tooLarge, setTooLarge] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<ImportResult | null>(null)

  // Song creation is admin in the rules, so the door closes here too — never
  // a form that would fail halfway through its first write.
  if (!isAdmin) return <Redirect href="/songs" />

  const close = (): void => {
    if (router.canGoBack()) router.back()
    else router.replace("/songs")
  }

  /** Picks and parses every file into one backup, then plans against the band. */
  const choose = async (): Promise<void> => {
    setPhase("parsing")
    setPlan(null)
    setResult(null)
    setTooLarge(false)
    setInvalidFiles(0)
    setSkippedRows([])
    try {
      const files = await pickImportFiles()
      if (files.length === 0) {
        setPhase("idle")
        return
      }

      let parsed: BandBackup = emptyBandBackup()
      const looseSongs: BandBackupSong[] = []
      const rows: number[] = []
      let invalid = 0
      let songIndex = 0

      for (const file of files) {
        const lower = file.name.toLowerCase()
        if (lower.endsWith(".json")) {
          const document = parseBandBackup(await file.text())
          if (document) parsed = mergeBackups(parsed, document)
          else invalid += 1
        } else if (lower.endsWith(".csv")) {
          const csv = parseSongsCsv(await file.text())
          if (csv.invalid) invalid += 1
          else {
            looseSongs.push(...csv.songs)
            rows.push(...csv.skippedRows)
          }
        } else if (lower.endsWith(".cho")) {
          const song = parseChoSource(await file.text(), `file_${songIndex}`, fileNameTitle(file.name))
          songIndex += 1
          if (song) looseSongs.push(song)
        } else if (lower.endsWith(".zip")) {
          for (const entry of await extractChoFiles(await file.bytes())) {
            const song = parseChoSource(entry.source, `zip_${songIndex}`, fileNameTitle(entry.name))
            songIndex += 1
            if (song) looseSongs.push(song)
          }
        } else {
          invalid += 1
        }
      }

      const merged = mergeBackups(parsed, { ...emptyBandBackup(), songs: looseSongs })
      const next = planBackupImport(merged, { songs, setlists, performances })
      setInvalidFiles(invalid)
      setSkippedRows(rows)
      setTooLarge(next.tooLarge)
      setPlan(
        next.songs.length + next.setlists.length + next.performances.length > 0 ? next : null,
      )
      setPhase("preview")
    } catch (error) {
      toast.showError(toFriendlyError(error, t("backup.invalidFile")))
      setPhase("idle")
    }
  }

  /** Replays the confirmed plan, then closes on the user's own pace. */
  const run = async (): Promise<void> => {
    if (!plan || !organizationId) return
    setPhase("importing")
    setProgress({
      done: 0,
      total: plan.songs.length + plan.setlists.length + plan.performances.length,
    })
    try {
      const imported = await executeImportPlan(
        organizationId,
        plan,
        { id: profile?.uid ?? "", name: profile?.displayName || "A member" },
        songLibrary,
        (done, total) => setProgress({ done, total }),
      )
      setResult(imported)
      setPhase("done")
      toast.showSuccess(t("backup.doneTitle"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("backup.importFailed")))
      setPhase("preview")
    }
  }

  // Derived before the JSX: inside the preview branch TypeScript narrows
  // `phase`, but the same block stays rendered while the import runs.
  const importing = phase === "importing"
  const parsing = phase === "parsing"

  return (
    <ModalScreen
      title={t("backup.importTitle")}
      subtitle={t("backup.title")}
      onClose={close}
    >
      <Card style={styles.card}>
        <AppText variant="caption" tone="muted">
          {t("backup.intro")}
        </AppText>
        <AppText variant="caption" tone="faint">
          {t("backup.csvHint")}
        </AppText>
        {phase === "done" && result ? (
          <View style={styles.block}>
            <AppText variant="caption" tone="muted">
              {t("backup.doneSummary", {
                songs: t("backup.songsCount", { count: result.songs }),
                setlists: t("backup.setlistsCount", { count: result.setlists }),
                events: t("backup.eventsCount", { count: result.performances }),
              })}
            </AppText>
            <Button label={t("backup.close")} onPress={close} />
          </View>
        ) : (
          <View style={styles.block}>
            <Button
              label={parsing ? t("backup.parsing") : t("backup.chooseFiles")}
              loading={parsing}
              disabled={importing}
              onPress={() => void choose()}
            />
            {phase === "preview" ? (
              plan && !tooLarge ? (
                <View style={styles.block}>
                  <AppText variant="caption" tone="muted">
                    {t("backup.previewSummary", {
                      songs: t("backup.songsCount", { count: plan.songs.length }),
                      setlists: t("backup.setlistsCount", { count: plan.setlists.length }),
                      events: t("backup.eventsCount", { count: plan.performances.length }),
                      skipped: t("backup.skippedCount", {
                        count:
                          plan.skipped.songs + plan.skipped.setlists + plan.skipped.performances,
                      }),
                    })}
                  </AppText>
                  {skippedRows.length > 0 ? (
                    <AppText variant="caption" tone="faint">
                      {t("backup.skippedRows", { rows: skippedRows.slice(0, 8).join(", ") })}
                    </AppText>
                  ) : null}
                  <Button
                    label={
                      importing
                        ? t("backup.progress", { done: progress.done, total: progress.total })
                        : t("backup.confirm")
                    }
                    loading={importing}
                    onPress={() => void run()}
                  />
                </View>
              ) : (
                <AppText variant="caption" tone="muted">
                  {plan ? t("backup.tooLarge", {
                    songs: IMPORT_CAPS.songs,
                    setlists: IMPORT_CAPS.setlists,
                    events: IMPORT_CAPS.performances,
                  }) : t("backup.nothingToImport")}
                </AppText>
              )
            ) : null}
          </View>
        )}
        {invalidFiles > 0 ? (
          <AppText variant="caption" tone="danger">
            {t("backup.invalidFile")}
          </AppText>
        ) : null}
      </Card>
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.m },
    block: { gap: Theme.spacing.s },
  })

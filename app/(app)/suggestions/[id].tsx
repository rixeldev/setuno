import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card, Chip } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import { ModalScreen } from "@/components/app/ModalScreen"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { acceptSuggestion, rejectSuggestion } from "@/services/suggestions"
import { toFriendlyError } from "@/services/errors"
import { formatRelativeTime } from "@/libs/format"
import { buildChordRow } from "@/libs/songUtils"
import { toDate } from "@/interfaces/timestamp"

const TYPE_LABEL_KEYS: Record<string, string> = {
  chord_change: "suggestions.chordChange",
  add_chord: "songs.addChord",
  remove_chord: "songs.removeChord",
  key_change: "suggestions.keyChange",
  lyrics_change: "suggestions.lyricFix",
  new_song: "suggestions.newSong",
  other: "suggestions.other",
}

/**
 * Suggestion review (docs §15). Admins accept (applies the change to the shared
 * songbook) or reject with a note; authors can withdraw their own request.
 */
export default function SuggestionDetail() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const params = useLocalSearchParams<{ id?: string }>()
  const suggestionId = params.id ?? null

  const { profile } = useAuth()
  const { organizationId, isAdmin } = useOrganization()
  const { suggestions, songLibrary } = useOrgData()

  const [rejectOpen, setRejectOpen] = useState(false)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  const suggestion = useMemo(
    () => suggestions.find((entry) => entry.id === suggestionId) ?? null,
    [suggestions, suggestionId],
  )
  const song = suggestion?.songId ? (songLibrary.get(suggestion.songId) ?? null) : null
  const isAuthor = suggestion?.authorId === profile?.uid
  const canReview = isAdmin && suggestion?.status === "pending"

  const change = suggestion?.change
  const chordDiff = change?.kind === "chord_change" ? change : null
  const sourceLine =
    chordDiff && song
      ? (song.sections.find((entry) => entry.id === chordDiff.sectionId)?.lines[chordDiff.lineIndex] ?? null)
      : null
  const sourceLyrics = change?.kind === "lyrics_change" && song
    ? (song.sections.find((entry) => entry.id === change.sectionId)?.lines[change.lineIndex] ?? null)
    : null

  const review = async (action: "accept" | "reject"): Promise<void> => {
    if (!suggestion || !organizationId) return
    setBusy(true)
    try {
      const reviewer = { id: profile?.uid ?? "", name: profile?.displayName || "An admin" }
      if (action === "accept") {
        await acceptSuggestion(organizationId, suggestion.id, reviewer)
        toast.showSuccess(t("suggestions.acceptedApplied"))
        router.replace(suggestion.songId ? `/songs/${suggestion.songId}` : "/songs")
        return
      }
      await rejectSuggestion(organizationId, suggestion.id, reviewer, note)
      setRejectOpen(false)
      setNote("")
      toast.showSuccess(t("suggestions.suggestionRejected"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("suggestions.couldNotReview")))
    } finally {
      setBusy(false)
    }
  }

  if (!suggestion) {
    return (
      <ModalScreen title={t("suggestions.suggestion")}>
        <EmptyState
          title={t("suggestions.suggestionNotFound")}
          message={t("suggestions.suggestionNotFoundDescription")}
          actionLabel={t("suggestions.backToSuggestions")}
          onAction={() => router.replace("/suggestions")}
        />
      </ModalScreen>
    )
  }

  return (
    <ModalScreen
      title={t("suggestions.suggestion")}
      subtitle={suggestion.songTitle || t("suggestions.newSong")}
    >
      <Card style={{ gap: Theme.spacing.m }}>
        <View style={styles.row}>
          <Chip label={t(TYPE_LABEL_KEYS[suggestion.type] ?? suggestion.type)} tone="primary" />
          <Badge
            label={t(`suggestions.${suggestion.status}`)}
            tone={
              suggestion.status === "accepted"
                ? "success"
                : suggestion.status === "rejected"
                  ? "danger"
                  : "accent"
            }
          />
        </View>

        <AppText variant="subheading">{suggestion.summary}</AppText>

        {suggestion.comment.trim().length > 0 ? (
          <View style={styles.quote}>
            <AppText variant="body" tone="muted">
              “{suggestion.comment}”
            </AppText>
          </View>
        ) : null}

        <AppText variant="caption" tone="faint">
          {t("suggestions.author", { name: suggestion.authorName })} ·{" "}
          {formatRelativeTime(toDate(suggestion.createdAt))}
        </AppText>

        {suggestion.reviewedAt ? (
          <AppText variant="caption" tone="faint">
            {t("suggestions.reviewedStatus", {
              status: t(`suggestions.${suggestion.status}`),
              name: suggestion.reviewedByName || t("common.unknownAdmin"),
              time: formatRelativeTime(toDate(suggestion.reviewedAt)),
            })}
          </AppText>
        ) : null}

        {suggestion.reviewNote.trim().length > 0 ? (
          <AppText variant="caption" tone="muted">
            {t("suggestions.adminNote", { note: suggestion.reviewNote })}
          </AppText>
        ) : null}
      </Card>

      <Card style={{ gap: Theme.spacing.m }}>
        <AppText variant="label" tone="faint">
          {t("suggestions.proposedChange")}
        </AppText>

        {chordDiff ? (
          <View style={{ gap: Theme.spacing.m }}>
            <View style={styles.diff}>
              <View style={[styles.diffCol, styles.diffFrom]}>
                <AppText variant="caption" tone="faint">
                  {t("suggestions.current")}
                </AppText>
                <AppText variant="mono" tone={chordDiff.from.length > 0 ? "default" : "faint"}>
                  {chordDiff.from || t("suggestions.noChord")}
                </AppText>
              </View>
              <View style={[styles.diffCol, styles.diffTo]}>
                <AppText variant="caption" tone="faint">
                  {t("suggestions.proposed")}
                </AppText>
                <AppText variant="mono" tone={chordDiff.to.length > 0 ? "accent" : "faint"}>
                  {chordDiff.to || t("suggestions.removeIt")}
                </AppText>
              </View>
            </View>

            {sourceLine ? (
              <View style={{ gap: 4 }}>
                <AppText variant="caption" tone="faint">
                  {t("suggestions.lineNumber", { line: chordDiff.lineIndex + 1 })}
                </AppText>
                <AppText variant="mono" tone="primary">
                  {buildChordRow(sourceLine.chords, sourceLine.text)}
                </AppText>
                <AppText variant="mono">
                  {sourceLine.text}
                </AppText>
              </View>
            ) : (
              <AppText variant="caption" tone="faint">
                {t("suggestions.originalUnavailable")}
              </AppText>
            )}
          </View>
        ) : null}

        {change?.kind === "key_change" ? (
          <View style={styles.diff}>
            <View style={[styles.diffCol, styles.diffFrom]}>
              <AppText variant="caption" tone="faint">
                {t("suggestions.current")}
              </AppText>
              <AppText variant="mono" tone="faint">
                {change.from || t("suggestions.noKey")}
              </AppText>
            </View>
            <View style={[styles.diffCol, styles.diffTo]}>
              <AppText variant="caption" tone="faint">
                {t("suggestions.proposed")}
              </AppText>
              <AppText variant="mono" tone="accent">
                {change.to}
              </AppText>
            </View>
          </View>
        ) : null}

        {change?.kind === "lyrics_change" ? (
          <View style={{ gap: 6 }}>
            <View style={{ gap: 2 }}>
              <AppText variant="caption" tone="faint">
                {t("suggestions.current")}
              </AppText>
              <AppText variant="body" tone="faint" style={styles.strike}>
                {sourceLyrics?.text || change.from}
              </AppText>
            </View>
            <View style={{ gap: 2 }}>
              <AppText variant="caption" tone="faint">
                {t("suggestions.proposed")}
              </AppText>
              <AppText variant="body">{change.to}</AppText>
            </View>
          </View>
        ) : null}

        {change?.kind === "new_song" ? (
          <View style={{ gap: 6 }}>
            <AppText variant="bodyStrong">{change.title}</AppText>
            <AppText variant="caption" tone="muted">
              {[change.artist, change.key].filter(Boolean).join(" · ") || t("suggestions.noArtistOrKey")}
            </AppText>
            {change.lyrics.trim().length > 0 ? (
              <AppText variant="mono" tone="muted" style={styles.preview}>
                {change.lyrics}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {change?.kind === "other" ? (
          <AppText variant="caption" tone="muted">
            {t("suggestions.generalNote")}
          </AppText>
        ) : null}
      </Card>

      {canReview ? (
        <View style={styles.actions}>
          <Button
            label={t("common.reject")}
            variant="secondary"
            onPress={() => setRejectOpen(true)}
            style={styles.action}
          />
          <Button
            label={t("suggestions.acceptApply")}
            loading={busy}
            onPress={() => void review("accept")}
            style={styles.action}
            accessibilityHint={t("suggestions.acceptHint")}
          />
        </View>
      ) : null}

      {!canReview && isAuthor && suggestion.status === "pending" ? (
        <AppText variant="caption" tone="muted">
          {t("suggestions.pendingNote")}
        </AppText>
      ) : null}

      {suggestion.songId ? (
        <Button
          label={t("suggestions.openSong")}
          variant="ghost"
          onPress={() => router.push(`/songs/${suggestion.songId}`)}
        />
      ) : null}

      <Dialog
        visible={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={t("suggestions.rejectTitle")}
        description={t("suggestions.rejectDescription")}
        confirmLabel={t("common.reject")}
        tone="danger"
        confirmLoading={busy}
        onConfirm={() => void review("reject")}
      >
        <Input
          label={t("suggestions.noteOptional")}
          value={note}
          onChangeText={setNote}
          placeholder={t("suggestions.rejectPlaceholder")}
          multiline
        />
      </Dialog>
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 6 },
    diff: { flexDirection: "row", gap: Theme.spacing.s, alignItems: "stretch" },
    diffCol: {
      flex: 1,
      minWidth: 0,
      gap: 4,
      padding: Theme.spacing.m,
      borderRadius: Theme.radii.m,
      backgroundColor: Theme.colors.surfaceMuted,
    },
    diffFrom: {},
    diffTo: { backgroundColor: Theme.colors.accentSoft },
    quote: {
      paddingLeft: Theme.spacing.m,
      borderLeftWidth: 2,
      borderLeftColor: Theme.colors.primary,
    },
    strike: { textDecorationLine: "line-through" },
    preview: { lineHeight: 20 },
    actions: { flexDirection: "row", gap: Theme.spacing.m },
    action: { flex: 1 },
  })
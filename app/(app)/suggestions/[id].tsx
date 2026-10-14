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
import { diffChordLine, diffWords } from "@/libs/songDiff"
import { DiffText } from "@/components/ui/DiffText"
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

  // What the reviewer actually reads (roadmap #54): the change marked *inside*
  // the line instead of two lines to compare by eye. A chord change goes
  // through the row builder so the monospace grid stays aligned around the one
  // chord that moves; a line the song has lost falls back to comparing the two
  // spellings on their own, and the lyrics diff against the song as it stands
  // now rather than as the suggestion found it.
  const chordSegments =
    !chordDiff ? null
    : sourceLine ? diffChordLine(sourceLine, chordDiff)
    : diffWords(chordDiff.from, chordDiff.to)
  const lyricsSegments =
    change?.kind === "lyrics_change" ?
      diffWords(sourceLyrics?.text ?? change.from, change.to)
    : null
  const keySegments = change?.kind === "key_change" ? diffWords(change.from, change.to) : null

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
        {chordSegments || lyricsSegments || keySegments ? (
          <AppText variant="caption" tone="faint">
            {t("suggestions.diffLegend")}
          </AppText>
        ) : null}

        {chordDiff ? (
          <View style={{ gap: Theme.spacing.m }}>
            <View style={{ gap: 4 }}>
              <AppText variant="caption" tone="faint">
                {t("suggestions.lineNumber", { line: chordDiff.lineIndex + 1 })}
              </AppText>
              {chordSegments ? <DiffText segments={chordSegments} mono /> : null}
              {sourceLine ? (
                <AppText variant="mono">{sourceLine.text}</AppText>
              ) : (
                <AppText variant="caption" tone="faint">
                  {t("suggestions.originalUnavailable")}
                </AppText>
              )}
            </View>
            {/* An empty proposal is the one thing the highlight cannot draw. */}
            {chordDiff.to.trim().length === 0 ? (
              <AppText variant="caption" tone="danger">
                {t("suggestions.removeIt")}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {keySegments ? <DiffText segments={keySegments} mono /> : null}

        {lyricsSegments ? <DiffText segments={lyricsSegments} /> : null}

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
    quote: {
      paddingLeft: Theme.spacing.m,
      borderLeftWidth: 2,
      borderLeftColor: Theme.colors.primary,
    },
    preview: { lineHeight: 20 },
    actions: { flexDirection: "row", gap: Theme.spacing.m },
    action: { flex: 1 },
  })
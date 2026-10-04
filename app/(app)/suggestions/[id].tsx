import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card, Chip } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { acceptSuggestion, rejectSuggestion } from "@/services/suggestions"
import { toFriendlyError } from "@/services/errors"
import { formatRelativeTime } from "@/libs/format"
import { toDate } from "@/interfaces/timestamp"
import { buildChordRow } from "@/components/songs/ChordLine"

const TYPE_LABELS: Record<string, string> = {
  chord_change: "Chord change",
  add_chord: "Add chord",
  remove_chord: "Remove chord",
  key_change: "Key change",
  lyrics_change: "Lyric fix",
  new_song: "New song",
  other: "Other",
}

/**
 * Suggestion review (docs §15). Admins accept (applies the change to the shared
 * songbook) or reject with a note; authors can withdraw their own request.
 */
export default function SuggestionDetail() {
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
        toast.showSuccess("Suggestion accepted and applied to the songbook.")
        router.replace(suggestion.songId ? `/songs/${suggestion.songId}` : "/songs")
        return
      }
      await rejectSuggestion(organizationId, suggestion.id, reviewer, note)
      setRejectOpen(false)
      setNote("")
      toast.showSuccess("Suggestion rejected.")
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't review that suggestion."))
    } finally {
      setBusy(false)
    }
  }

  if (!suggestion) {
    return (
      <ScreenContainer back title="Suggestion">
        <EmptyState
          title="Suggestion not found"
          message="It may have been deleted by its author."
          actionLabel="Back to suggestions"
          onAction={() => router.replace("/suggestions")}
        />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer back title="Suggestion" subtitle={suggestion.songTitle || "New song"}>
      <Card style={{ gap: Theme.spacing.m }}>
        <View style={styles.row}>
          <Chip label={TYPE_LABELS[suggestion.type] ?? suggestion.type} tone="primary" />
          <Badge
            label={suggestion.status}
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
          Suggested by {suggestion.authorName} · {formatRelativeTime(toDate(suggestion.createdAt))}
        </AppText>

        {suggestion.reviewedAt ? (
          <AppText variant="caption" tone="faint">
            {suggestion.status === "accepted" ? "Accepted" : "Rejected"} by{" "}
            {suggestion.reviewedByName || "an admin"} · {formatRelativeTime(toDate(suggestion.reviewedAt))}
          </AppText>
        ) : null}

        {suggestion.reviewNote.trim().length > 0 ? (
          <AppText variant="caption" tone="muted">
            Admin note: {suggestion.reviewNote}
          </AppText>
        ) : null}
      </Card>

      <Card style={{ gap: Theme.spacing.m }}>
        <AppText variant="label" tone="faint">
          Proposed change
        </AppText>

        {chordDiff ? (
          <View style={{ gap: Theme.spacing.m }}>
            <View style={styles.diff}>
              <View style={[styles.diffCol, styles.diffFrom]}>
                <AppText variant="caption" tone="faint">
                  Current
                </AppText>
                <AppText variant="mono" tone={chordDiff.from.length > 0 ? "default" : "faint"}>
                  {chordDiff.from || "no chord"}
                </AppText>
              </View>
              <View style={[styles.diffCol, styles.diffTo]}>
                <AppText variant="caption" tone="faint">
                  Proposed
                </AppText>
                <AppText variant="mono" tone={chordDiff.to.length > 0 ? "accent" : "faint"}>
                  {chordDiff.to || "remove it"}
                </AppText>
              </View>
            </View>

            {sourceLine ? (
              <View style={{ gap: 4 }}>
                <AppText variant="caption" tone="faint">
                  Line {chordDiff.lineIndex + 1}
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
                The original song is no longer available, so only the chord change is shown.
              </AppText>
            )}
          </View>
        ) : null}

        {change?.kind === "key_change" ? (
          <View style={styles.diff}>
            <View style={[styles.diffCol, styles.diffFrom]}>
              <AppText variant="caption" tone="faint">
                Current
              </AppText>
              <AppText variant="mono" tone="faint">
                {change.from || "no key"}
              </AppText>
            </View>
            <View style={[styles.diffCol, styles.diffTo]}>
              <AppText variant="caption" tone="faint">
                Proposed
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
                Current
              </AppText>
              <AppText variant="body" tone="faint" style={styles.strike}>
                {sourceLyrics?.text || change.from}
              </AppText>
            </View>
            <View style={{ gap: 2 }}>
              <AppText variant="caption" tone="faint">
                Proposed
              </AppText>
              <AppText variant="body">{change.to}</AppText>
            </View>
          </View>
        ) : null}

        {change?.kind === "new_song" ? (
          <View style={{ gap: 6 }}>
            <AppText variant="bodyStrong">{change.title}</AppText>
            <AppText variant="caption" tone="muted">
              {[change.artist, change.key].filter(Boolean).join(" · ") || "No artist or key given"}
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
            A general note for the band — accepting it won’t change the songbook.
          </AppText>
        ) : null}
      </Card>

      {canReview ? (
        <View style={styles.actions}>
          <Button
            label="Reject"
            variant="secondary"
            onPress={() => setRejectOpen(true)}
            style={styles.action}
          />
          <Button
            label="Accept & apply"
            loading={busy}
            onPress={() => void review("accept")}
            style={styles.action}
            accessibilityHint="Applies this change to the shared songbook"
          />
        </View>
      ) : null}

      {!canReview && isAuthor && suggestion.status === "pending" ? (
        <AppText variant="caption" tone="muted">
          Waiting for an admin to review. You’ll see the result here.
        </AppText>
      ) : null}

      {suggestion.songId ? (
        <Button
          label="Open the song"
          variant="ghost"
          onPress={() => router.push(`/songs/${suggestion.songId}`)}
        />
      ) : null}

      <Dialog
        visible={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject this suggestion?"
        description="The suggestion stays in the list as rejected. The songbook is untouched."
        confirmLabel="Reject"
        tone="danger"
        confirmLoading={busy}
        onConfirm={() => void review("reject")}
      >
        <Input
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="We sing it the other way round on stage."
          multiline
        />
      </Dialog>
    </ScreenContainer>
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
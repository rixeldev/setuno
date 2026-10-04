import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card, Chip } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { EmptyState, Skeleton } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { PageHeader } from "@/components/ui/PageHeader"
import { ChordPadContent } from "@/components/songs/editor/ChordPad"
import { Dialog } from "@/components/ui/Dialog"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { subscribeSong } from "@/services/songs"
import { createSuggestion } from "@/services/suggestions"
import { toFriendlyError } from "@/services/errors"
import { setChordAt } from "@/libs/songUtils"
import { wordStarts } from "@/libs/chords"
import { validateRequired } from "@/libs/validation"
import type { Song, SuggestionChange, SuggestionType } from "@/interfaces"

/** Chord related suggestion types share the same pickers. */
const CHORD_TYPES: SuggestionType[] = ["chord_change", "add_chord", "remove_chord"]

const TYPE_LABELS: Record<SuggestionType, string> = {
  chord_change: "Change a chord",
  add_chord: "Add a chord",
  remove_chord: "Remove a chord",
  key_change: "Change the key",
  lyrics_change: "Fix a lyric",
  new_song: "New song",
  other: "Something else",
}

/**
 * Suggestion composer for a song (docs §13). Members describe the change; an
 * admin reviews and applies it, which keeps the chord book authoritative.
 */
export default function SuggestForSong() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const params = useLocalSearchParams<{ id?: string }>()
  const songId = params.id ?? null

  const { profile } = useAuth()
  const { organizationId } = useOrganization()

  const [song, setSong] = useState<Song | null>(null)
  const [type, setType] = useState<SuggestionType>("chord_change")
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [lineIndex, setLineIndex] = useState<number | null>(null)
  const [position, setPosition] = useState<number | null>(null)
  const [chord, setChord] = useState("")
  const [newKey, setNewKey] = useState("")
  const [lyrics, setLyrics] = useState("")
  const [comment, setComment] = useState("")
  const [padOpen, setPadOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const subscribe = React.useCallback(
    (onChange: (value: Song | null) => void) => subscribeSong(organizationId, songId, onChange),
    [organizationId, songId],
  )

  React.useEffect(() => subscribe(setSong), [subscribe])

  const section = useMemo(
    () => song?.sections.find((entry) => entry.id === sectionId) ?? null,
    [song, sectionId],
  )
  const line = section && lineIndex !== null ? (section.lines[lineIndex] ?? null) : null
  const isChordType = CHORD_TYPES.includes(type)
  const existingChord = useMemo(() => {
    if (!line || position === null) return ""
    return line.chords.find((entry) => entry.position === position)?.chord ?? ""
  }, [line, position])

  const pickType = (value: SuggestionType): void => {
    setType(value)
    setSectionId(null)
    setLineIndex(null)
    setPosition(null)
    setChord("")
    setNewKey(song?.key ?? "")
    setLyrics("")
  }

  const submit = async (): Promise<void> => {
    if (!song) return
    setFormError(null)

    if (isChordType && (sectionId === null || lineIndex === null || position === null)) {
      setFormError("Pick the line and the word the chord belongs to.")
      return
    }
    if (type === "add_chord" && chord.trim().length === 0) {
      setFormError("Choose the chord you want to add.")
      return
    }
    if (type === "lyrics_change" && lyrics.trim() === line?.text.trim()) {
      setFormError("Edit the lyric text before submitting.")
      return
    }
    if (type === "key_change" && newKey.trim().length === 0) {
      setFormError("Pick the new key.")
      return
    }
    const commentError = validateRequired(comment, "Add a short note so the admin understands the change.")
    if (commentError) {
      setFormError(commentError)
      return
    }

    let change: SuggestionChange
    let summary: string

    if (isChordType && section && lineIndex !== null && position !== null) {
      change = {
        kind: "chord_change",
        sectionId: section.id,
        lineIndex,
        position,
        from: existingChord,
        to: type === "remove_chord" ? "" : chord,
      }
      summary = `${section.label} · line ${lineIndex + 1} · ${
        existingChord.length > 0 ? `${existingChord} → ` : ""
      }${type === "remove_chord" ? "remove chord" : chord}`
    } else if (type === "key_change") {
      change = { kind: "key_change", from: song.key, to: newKey }
      summary = `Key ${song.key || "—"} → ${newKey}`
    } else if (type === "lyrics_change" && section && lineIndex !== null) {
      change = { kind: "lyrics_change", sectionId: section.id, lineIndex, from: line?.text ?? "", to: lyrics }
      summary = `${section.label} · line ${lineIndex + 1} lyric fix`
    } else {
      change = { kind: "other" }
      summary = "General note"
    }

    setSaving(true)
    try {
      await createSuggestion(
        organizationId ?? "",
        {
          songId: song.id,
          songTitle: song.title,
          type,
          change,
          summary,
          comment,
        },
        { id: profile?.uid ?? "", name: profile?.displayName || "A member" },
      )
      toast.showSuccess("Thanks! An admin will review your suggestion.")
      router.replace(`/songs/${song.id}`)
    } catch (error) {
      const message = toFriendlyError(error, "We couldn't send that suggestion.")
      setFormError(message)
      toast.showError(message)
    } finally {
      setSaving(false)
    }
  }

  if (!song) {
    return (
      <View style={styles.host}>
        <PageHeader title="Suggest a change" back elevated />
        <View style={styles.loading}>
          <Skeleton height={120} />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.host}>
      <PageHeader title="Suggest a change" subtitle={song.title} back elevated />

      <ScreenContainer scroll style={styles.body}>
        <Card style={{ gap: Theme.spacing.m }}>
          <AppText variant="label" tone="faint">
            What needs changing?
          </AppText>
          <View style={styles.wrap}>
            {(["chord_change", "add_chord", "remove_chord", "key_change", "lyrics_change", "other"] as SuggestionType[]).map(
              (entry) => (
                <Chip
                  key={entry}
                  label={TYPE_LABELS[entry]}
                  tone="primary"
                  selected={type === entry}
                  onPress={() => pickType(entry)}
                />
              ),
            )}
          </View>
        </Card>

        {isChordType || type === "lyrics_change" ? (
          <Card style={{ gap: Theme.spacing.m }}>
            <AppText variant="label" tone="faint">
              Where?
            </AppText>

            <View style={styles.wrap}>
              {song.sections.map((entry) => (
                <Chip
                  key={entry.id}
                  label={entry.label}
                  tone="primary"
                  selected={sectionId === entry.id}
                  onPress={() => {
                    setSectionId(entry.id)
                    setLineIndex(null)
                    setPosition(null)
                  }}
                />
              ))}
            </View>

            {section ? (
              <View style={styles.wrap}>
                {section.lines.map((entry, index) => (
                  <Chip
                    key={`${section.id}-${index}`}
                    label={truncate(entry.text, 22) || `Line ${index + 1}`}
                    selected={lineIndex === index}
                    onPress={() => {
                      setLineIndex(index)
                      setPosition(null)
                      setLyrics(entry.text)
                    }}
                  />
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}

        {isChordType && line ? (
          <Card style={{ gap: Theme.spacing.m }}>
            <AppText variant="label" tone="faint">
              Which word does the chord sit on?
            </AppText>
            <View style={styles.wrap}>
              {wordStarts(line.text).map((start) => {
                const word = line.text.slice(start).split(/\s/)[0] ?? ""
                const current = line.chords.find((entry) => entry.position === start)?.chord ?? ""
                return (
                  <Chip
                    key={`word-${start}`}
                    label={current ? `${word} (${current})` : word}
                    tone="accent"
                    selected={position === start}
                    onPress={() => setPosition(start)}
                  />
                )
              })}
              {wordStarts(line.text).length === 0 ? (
                <Chip label="Start of the line" selected={position === 0} onPress={() => setPosition(0)} />
              ) : null}
            </View>
          </Card>
        ) : null}

        {isChordType && line && position !== null ? (
          <Card style={{ gap: Theme.spacing.m }}>
            <AppText variant="label" tone="faint">
              Chord at “{line.text.slice(position).split(/\s/)[0] || "end of line"}”
            </AppText>
            {line.chords.length > 0 ? (
              <View style={styles.wrap}>
                {line.chords.map((entry) => (
                  <Chip
                    key={`${entry.position}-${entry.chord}`}
                    label={`${entry.chord} @ ${entry.position}`}
                    tone="accent"
                    selected={position === entry.position}
                    onPress={() => setPosition(entry.position)}
                  />
                ))}
              </View>
            ) : null}

            {type !== "remove_chord" ? (
              <Button
                label={chord ? `Chord: ${chord}` : "Choose a chord"}
                variant="secondary"
                onPress={() => setPadOpen(true)}
              />
            ) : null}
          </Card>
        ) : null}

        {type === "key_change" ? (
          <Card style={{ gap: Theme.spacing.m }}>
            <AppText variant="label" tone="faint">
              New key
            </AppText>
            <Input
              value={newKey}
              onChangeText={setNewKey}
              placeholder={song.key || "C"}
              autoCapitalize="characters"
              hint={`Current key: ${song.key || "not set"}`}
            />
          </Card>
        ) : null}

        {type === "lyrics_change" && line ? (
          <Card style={{ gap: Theme.spacing.m }}>
            <AppText variant="label" tone="faint">
              Corrected lyric
            </AppText>
            <Input value={lyrics} onChangeText={setLyrics} multiline />
          </Card>
        ) : null}

        <Card style={{ gap: Theme.spacing.m }}>
          <Input
            label="Note for the admin"
            required
            value={comment}
            onChangeText={setComment}
            multiline
            placeholder="We always sing it like this on stage…"
          />
        </Card>

        {formError ? (
          <AppText variant="caption" tone="danger" accessibilityRole="alert">
            {formError}
          </AppText>
        ) : null}

        <Button label="Send suggestion" loading={saving} onPress={() => void submit()} />

        {song.sections.length === 0 ? (
          <EmptyState compact title="Nothing to suggest yet" message="This song has no lyrics yet." />
        ) : null}
      </ScreenContainer>

      <Dialog
        visible={padOpen}
        onClose={() => setPadOpen(false)}
        title="Which chord?"
        description="Pick the chord that should sit above the word."
        hideActions
      >
        <ChordPadContent
          initialChord={chord}
          songKey={song.key}
          onPick={setChord}
          onCancel={() => setPadOpen(false)}
          header={
            line && position !== null ? (
              <View style={styles.preview}>
                <AppText variant="caption" tone="faint">
                  {line.text}
                </AppText>
                <AppText variant="caption" tone="primary">
                  {(setChordAt(line.chords, position, chord || existingChord, line.text.length) ?? [])
                    .map((entry) => `${"·".repeat(entry.position)}${entry.chord}`)
                    .join(" ")}
                </AppText>
              </View>
            ) : undefined
          }
        />
      </Dialog>
    </View>
  )
}

const truncate = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1, backgroundColor: Theme.colors.background },
    body: { paddingTop: Theme.spacing.l, gap: Theme.spacing.l },
    loading: { padding: Theme.spacing.l },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    preview: { gap: 4, padding: Theme.spacing.s, borderRadius: Theme.radii.s, backgroundColor: Theme.colors.background2 },
  })
import React, { useMemo, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card, Chip } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { PageHeader } from "@/components/ui/PageHeader"
import { Dialog } from "@/components/ui/Dialog"
import { useToast } from "@/components/ui/Toast"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { SongEditor } from "@/components/songs/editor/SongEditor"
import { KeyIcon, MusicIcon } from "@/components/ui/Icons"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { createSong, updateSong } from "@/services/songs"
import { toFriendlyError } from "@/services/errors"
import { MAJOR_KEYS, MINOR_KEYS } from "@/libs/chords"
import { createSection, emptyLine, sectionLabel } from "@/libs/songUtils"
import { parseTags, validateBpm, validateCapo, validateRequired } from "@/libs/validation"
import { parseDurationInput } from "@/libs/format"
import type { SongInput, SongSection, Song } from "@/interfaces"

interface SongFormProps {
  /** Provided when editing an existing song. */
  song?: Song | null
  /** Fired after a successful save with the new/updated song id. */
  onSaved?: (songId: string) => void
  title?: string
  subtitle?: string
  headerRight?: React.ReactNode
}

/**
 * Song form + chord editor (docs §9, §10). Creation and editing share this
 * screen so validation and normalisation behave identically.
 */
export function SongForm({ song, onSaved, title, subtitle, headerRight }: SongFormProps) {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { profile } = useAuth()
  const { organizationId } = useOrganization()

  const [songTitle, setSongTitle] = useState(song?.title ?? "")
  const [artist, setArtist] = useState(song?.artist ?? "")
  const [key, setKey] = useState(song?.key ?? "C")
  const [capo, setCapo] = useState(String(song?.capo ?? 0))
  const [bpm, setBpm] = useState(song?.bpm ? String(song.bpm) : "")
  const [duration, setDuration] = useState(song?.durationSec ? formatSeconds(song.durationSec) : "")
  const [genre, setGenre] = useState(song?.genre ?? "")
  const [tags, setTags] = useState(song?.tags.join(", ") ?? "")
  const [notes, setNotes] = useState(song?.notes ?? "")
  // A brand-new song opens with one blank line, so the editor is immediately
  // usable instead of showing an empty section with nothing to type into.
  const [sections, setSections] = useState<SongSection[]>(
    song?.sections ?? [createSection("verse", sectionLabel("verse", 1), [emptyLine()])],
  )

  const [keyPicker, setKeyPicker] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Opening the editor for a different song replaces the whole form. This is
  // React's documented "adjust state while rendering" pattern: the fields never
  // show a frame of the previous song and no extra render pass is needed.
  const [loadedSongId, setLoadedSongId] = useState(song?.id ?? null)
  if (song && song.id !== loadedSongId) {
    setLoadedSongId(song.id)
    setSongTitle(song.title)
    setArtist(song.artist)
    setKey(song.key || "C")
    setCapo(String(song.capo))
    setBpm(song.bpm ? String(song.bpm) : "")
    setDuration(song.durationSec ? formatSeconds(song.durationSec) : "")
    setGenre(song.genre)
    setTags(song.tags.join(", "))
    setNotes(song.notes)
    setSections(song.sections)
    setErrors({})
    setFormError(null)
  }

  const keyOptions = useMemo(
    () => [...MAJOR_KEYS.map((value) => ({ value, label: value })), ...MINOR_KEYS.map((value) => ({ value, label: value }))],
    [],
  )

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    const titleError = validateRequired(songTitle, "Give the song a title.")
    if (titleError) next.title = titleError
    const capoError = validateCapo(capo)
    if (capoError) next.capo = capoError
    const bpmError = validateBpm(bpm)
    if (bpmError) next.bpm = bpmError
    if (duration.trim().length > 0 && parseDurationInput(duration) === null) {
      next.duration = "Use mm:ss, for example 3:42."
    }
    if (sections.length === 0) next.sections = "Add at least one section."

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = async (): Promise<void> => {
    setFormError(null)
    if (!validate()) {
      toast.showError("Check the highlighted fields.")
      return
    }
    setSaving(true)
    try {
      const input: SongInput = {
        title: songTitle,
        artist,
        key,
        originalKey: song?.originalKey || key,
        capo: Number.parseInt(capo, 10) || 0,
        bpm: bpm.trim().length > 0 ? Number.parseInt(bpm, 10) : null,
        durationSec: parseDurationInput(duration),
        genre,
        notes,
        tags: parseTags(tags),
        sections,
      }

      const actor = { id: profile?.uid ?? "", name: profile?.displayName || "An admin" }
      if (song) {
        await updateSong(organizationId ?? "", song.id, input, actor)
        toast.showSuccess(`"${input.title}" was updated.`)
        onSaved?.(song.id)
      } else {
        const id = await createSong(organizationId ?? "", input, actor)
        toast.showSuccess(`"${input.title}" was added to the songbook.`)
        onSaved?.(id)
      }
    } catch (error) {
      const message = toFriendlyError(error, "We couldn't save that song.")
      setFormError(message)
      toast.showError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.host}>
      <PageHeader
        title={title ?? (song ? `Edit ${song.title}` : "New song")}
        subtitle={subtitle ?? "Lyrics, chords and performance details"}
        back
        elevated
        right={headerRight}
      />

      <ScreenContainer scroll style={styles.body}>
        <Card style={styles.formCard}>
          <Input
            label="Title"
            required
            value={songTitle}
            onChangeText={setSongTitle}
            placeholder="Wonderwall"
            error={errors.title}
            autoCapitalize="words"
            icon={<MusicIcon size={16} color={Theme.colors.textFaint} />}
          />
          <Input
            label="Artist"
            value={artist}
            onChangeText={setArtist}
            placeholder="Oasis"
            autoCapitalize="words"
          />
          <Input
            label="Genre"
            value={genre}
            onChangeText={setGenre}
            placeholder="Britpop"
            autoCapitalize="words"
          />
          <Input
            label="Tags"
            value={tags}
            onChangeText={setTags}
            placeholder="acoustic, singalong"
            hint="Comma separated. Used by the song filters."
            autoCapitalize="none"
          />
        </Card>

        <Card style={styles.formCard}>
          <AppText variant="label" tone="faint">
            Performance
          </AppText>

          <View style={styles.keyRow}>
            <View style={styles.keyField}>
              <AppText variant="caption" tone="muted">
                Key
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Key ${key}. Tap to change`}
                onPress={() => setKeyPicker(true)}
                style={({ pressed }) => [styles.keyButton, pressed && styles.pressed]}
              >
                <KeyIcon size={16} color={Theme.colors.accent} />
                <AppText variant="bodyStrong">{key || "—"}</AppText>
              </Pressable>
            </View>

            <Input
              label="Capo"
              value={capo}
              onChangeText={setCapo}
              keyboardType="number-pad"
              placeholder="0"
              error={errors.capo}
              containerStyle={styles.smallField}
            />
            <Input
              label="BPM"
              value={bpm}
              onChangeText={setBpm}
              keyboardType="number-pad"
              placeholder="120"
              error={errors.bpm}
              containerStyle={styles.smallField}
            />
            <Input
              label="Length"
              value={duration}
              onChangeText={setDuration}
              placeholder="3:42"
              error={errors.duration}
              containerStyle={styles.smallField}
            />
          </View>

          <Input
            label="Performance notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Start quietly, drop to capo 2 for the last chorus…"
          />
        </Card>

        <SongEditor sections={sections} onChange={setSections} songKey={key} fontSize={16} />

        {errors.sections ? (
          <AppText variant="caption" tone="danger">
            {errors.sections}
          </AppText>
        ) : null}

        {formError ? (
          <AppText variant="caption" tone="danger" accessibilityRole="alert">
            {formError}
          </AppText>
        ) : null}

        <View style={styles.actions}>
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} style={styles.action} />
          <Button
            label={song ? "Save changes" : "Add song"}
            loading={saving}
            onPress={() => void save()}
            style={styles.action}
          />
        </View>
      </ScreenContainer>

      <Dialog
        visible={keyPicker}
        onClose={() => setKeyPicker(false)}
        title="Choose a key"
        description="This is the key the chords are written in."
      >
        <View style={styles.keyOptions}>
          {keyOptions.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              tone="accent"
              selected={key === option.value}
              onPress={() => {
                setKey(option.value)
                setKeyPicker(false)
              }}
            />
          ))}
        </View>
      </Dialog>
    </View>
  )
}

/** Seconds to `m:ss`. */
const formatSeconds = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}:${`${rest}`.padStart(2, "0")}`
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1, backgroundColor: Theme.colors.background },
    body: { paddingTop: Theme.spacing.l },
    formCard: { gap: Theme.spacing.m },
    keyRow: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.s },
    keyField: { flexGrow: 1, minWidth: 120, gap: 6 },
    keyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      minHeight: 46,
      paddingHorizontal: Theme.spacing.l,
      borderRadius: Theme.radii.m,
      borderWidth: 1,
      borderColor: Theme.colors.border,
      backgroundColor: Theme.colors.surface,
    },
    smallField: { flexGrow: 1, minWidth: 90 },
    keyOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    actions: { flexDirection: "row", gap: Theme.spacing.m },
    action: { flex: 1 },
    pressed: { opacity: 0.7 },
  })
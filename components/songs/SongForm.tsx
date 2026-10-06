import React, { useMemo, useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

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
import { AppBackground } from "@/components/app/AppBackground"
import { DiscardChangesDialog } from "@/components/app/DiscardChangesDialog"
import { SongEditor } from "@/components/songs/editor/SongEditor"
import { ChevronDownIcon, ChevronUpIcon, KeyIcon, MusicIcon } from "@/components/ui/Icons"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useResponsive } from "@/hooks/useResponsive"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"
import { createSong, updateSong } from "@/services/songs"
import { toFriendlyError } from "@/services/errors"
import { MAJOR_KEYS, MINOR_KEYS } from "@/libs/chords"
import { createSection, emptyLine, sectionLabel } from "@/libs/songUtils"
import { parseTags, validateBpm, validateCapo, validateDuration, validateRequired } from "@/libs/validation"
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

interface SongFormState {
  title: string
  artist: string
  key: string
  capo: string
  bpm: string
  duration: string
  genre: string
  tags: string
  notes: string
  sections: SongSection[]
}

/** Stable snapshot used to detect unsaved changes. */
const serializeForm = (state: SongFormState): string => JSON.stringify(state)

const formStateFrom = (
  song: Song | null | undefined,
  fallbackSections: SongSection[],
): SongFormState => ({
  title: song?.title ?? "",
  artist: song?.artist ?? "",
  key: song?.key ?? "C",
  capo: String(song?.capo ?? 0),
  bpm: song?.bpm ? String(song.bpm) : "",
  duration: song?.durationSec ? formatSeconds(song.durationSec) : "",
  genre: song?.genre ?? "",
  tags: song?.tags.join(", ") ?? "",
  notes: song?.notes ?? "",
  sections: song?.sections ?? fallbackSections,
})

/**
 * Song form + chord editor (docs §9, §10). Creation and editing share this
 * screen so validation and normalisation behave identically.
 *
 * Layout follows the order of the task: name the song, check the key, write the
 * lyrics and place the chords, and tuck the optional metadata behind
 * “More details”. The primary action lives in a sticky footer so it is always
 * one tap away, no matter how long the lyrics are.
 */
export function SongForm({ song, onSaved, title, subtitle, headerRight }: SongFormProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const { profile } = useAuth()
  const { organizationId } = useOrganization()
  const { gutter, contentMaxWidth } = useResponsive()

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
  const [sectionTemplate] = useState<SongSection[]>(() => [
    createSection("verse", sectionLabel("verse", 1), [emptyLine()]),
  ])
  const [sections, setSections] = useState<SongSection[]>(song?.sections ?? sectionTemplate)
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(song && (song.genre || song.tags.length > 0 || song.bpm || song.durationSec || song.notes)),
  )

  const [keyPicker, setKeyPicker] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Snapshot of the last saved state: anything different means unsaved work.
  const [baseline, setBaseline] = useState(() => serializeForm(formStateFrom(song, sectionTemplate)))

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
    setBaseline(serializeForm(formStateFrom(song, sectionTemplate)))
  }

  const currentState: SongFormState = {
    title: songTitle,
    artist,
    key,
    capo,
    bpm,
    duration,
    genre,
    tags,
    notes,
    sections,
  }
  // `saving` is included so the navigation that follows a successful save is
  // never mistaken for abandoning the form.
  const hasUnsavedChanges = serializeForm(currentState) !== baseline && !saving
  const leaveGuard = useUnsavedChanges(hasUnsavedChanges)

  const keyOptions = useMemo(
    () => [...MAJOR_KEYS.map((value) => ({ value, label: value })), ...MINOR_KEYS.map((value) => ({ value, label: value }))],
    [],
  )

  /** Drops the error of the field the user is fixing, so it never feels stale. */
  const clearError = (field: string): void => {
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const close = (): void => {
    if (router.canGoBack()) router.back()
    else router.replace("/songs")
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    const titleError = validateRequired(songTitle, t("songs.titleRequired"), { max: 120 })
    if (titleError) next.title = titleError
    const capoError = validateCapo(capo)
    if (capoError) next.capo = capoError
    const bpmError = validateBpm(bpm)
    if (bpmError) next.bpm = bpmError
    const durationError = validateDuration(duration)
    if (durationError) next.duration = durationError
    if (sections.length === 0) next.sections = t("songs.atLeastOneSection")

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = async (): Promise<void> => {
    setFormError(null)
    if (!validate()) {
      toast.showError(t("songs.checkFields"))
      return
    }
    if (!organizationId) {
      const message = t("songs.noBand")
      setFormError(message)
      toast.showError(message)
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
        await updateSong(organizationId, song.id, input, actor)
        toast.showSuccess(t("songs.songUpdated", { title: input.title.trim() }))
        // Saved: the form is in sync again, so leaving is safe.
        setBaseline(serializeForm(currentState))
        onSaved?.(song.id)
      } else {
        const id = await createSong(organizationId, input, actor)
        toast.showSuccess(t("songs.songCreated", { title: input.title.trim() }))
        setBaseline(serializeForm(currentState))
        onSaved?.(id)
      }
    } catch (error) {
      const message = toFriendlyError(error, t("songs.couldNotSave"))
      setFormError(message)
      toast.showError(message)
    } finally {
      setSaving(false)
    }
  }

  const missingTitle = songTitle.trim().length === 0
  const footerMessage = formError ?? (missingTitle ? t("songs.addTitleToSave") : null)

  return (
    <KeyboardAvoidingView
      style={styles.host}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AppBackground />
      <PageHeader
        title={title ?? (song ? t("songs.editSongTitle", { title: song.title }) : t("songs.newSong"))}
        subtitle={subtitle ?? t("songs.formSubtitle")}
        back
        elevated
        right={headerRight}
      />

      <ScreenContainer scroll style={styles.body}>
        <Card style={styles.formCard}>
          <Input
            label={t("songs.songTitle")}
            required
            value={songTitle}
            onChangeText={(value) => {
              setSongTitle(value)
              clearError("title")
            }}
            placeholder="Wonderwall"
            error={errors.title}
            autoCapitalize="words"
            maxLength={120}
            icon={<MusicIcon size={16} color={Theme.colors.textFaint} />}
          />
          <Input
            label={t("songs.artist")}
            value={artist}
            onChangeText={setArtist}
            placeholder="Oasis"
            autoCapitalize="words"
          />
          <View style={styles.keyRow}>
            <View style={styles.keyField}>
              <AppText variant="caption" tone="muted">
                {t("songs.key")}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("songs.keyA11y", { key })}
                onPress={() => setKeyPicker(true)}
                style={({ pressed }) => [styles.keyButton, pressed && styles.pressed]}
              >
                <KeyIcon size={16} color={Theme.colors.accent} />
                <AppText variant="bodyStrong">{key || "—"}</AppText>
              </Pressable>
            </View>
            <Input
              label={t("songs.capo")}
              value={capo}
              onChangeText={(value) => {
                setCapo(value)
                clearError("capo")
              }}
              keyboardType="number-pad"
              placeholder="0"
              error={errors.capo}
              containerStyle={styles.smallField}
            />
          </View>
        </Card>

        <View style={styles.editorBlock}>
          <View style={styles.editorHeader}>
            <AppText variant="label" tone="faint">
              {t("songs.lyricsAndChords")}
            </AppText>
            <AppText variant="caption" tone="muted">
              {t("songs.placeCursorHint")}
            </AppText>
          </View>

          <SongEditor sections={sections} onChange={setSections} songKey={key} fontSize={16} />

          {errors.sections ? (
            <AppText variant="caption" tone="danger" accessibilityRole="alert">
              {errors.sections}
            </AppText>
          ) : null}
        </View>

        <Card style={styles.formCard}>
          <Pressable
            onPress={() => setDetailsOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: detailsOpen }}
            accessibilityLabel={t("songs.moreDetailsA11y")}
            style={({ pressed }) => [styles.detailsHeader, pressed && styles.pressed]}
          >
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{t("songs.moreDetails")}</AppText>
              <AppText variant="caption" tone="muted">
                {t("songs.moreDetailsHint")}
              </AppText>
            </View>
            {detailsOpen ? (
              <ChevronUpIcon size={18} color={Theme.colors.textMuted} />
            ) : (
              <ChevronDownIcon size={18} color={Theme.colors.textMuted} />
            )}
          </Pressable>

          {detailsOpen ? (
            <View style={styles.detailsBody}>
              <Input
                label={t("songs.genre")}
                value={genre}
                onChangeText={setGenre}
                placeholder="Britpop"
                autoCapitalize="words"
              />
              <Input
                label={t("songs.tags")}
                value={tags}
                onChangeText={setTags}
                placeholder="acoustic, singalong"
                hint={t("songs.tagsHelp")}
                autoCapitalize="none"
              />
              <View style={styles.keyRow}>
                <Input
                  label={t("songs.bpm")}
                  value={bpm}
                  onChangeText={(value) => {
                    setBpm(value)
                    clearError("bpm")
                  }}
                  keyboardType="number-pad"
                  placeholder="120"
                  error={errors.bpm}
                  containerStyle={styles.smallField}
                />
                <Input
                  label={t("songs.length")}
                  value={duration}
                  onChangeText={(value) => {
                    setDuration(value)
                    clearError("duration")
                  }}
                  placeholder="3:42"
                  error={errors.duration}
                  containerStyle={styles.smallField}
                />
              </View>
              <Input
                label={t("songs.performanceNotes")}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder={t("songs.notesPlaceholder")}
              />
            </View>
          ) : null}
        </Card>
      </ScreenContainer>

      <View style={[styles.footer, { paddingHorizontal: gutter }]}>
        <View style={[styles.footerInner, { maxWidth: contentMaxWidth }]}>
          {footerMessage ? (
            <AppText
              variant="caption"
              tone={formError ? "danger" : "muted"}
              accessibilityRole={formError ? "alert" : undefined}
            >
              {footerMessage}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button label={t("common.cancel")} variant="ghost" onPress={close} style={styles.action} />
            <Button
              label={song ? t("songs.saveSong") : t("songs.createSong")}
              loading={saving}
              onPress={() => void save()}
              style={styles.action}
            />
          </View>
        </View>
      </View>

      <Dialog
        visible={keyPicker}
        onClose={() => setKeyPicker(false)}
        title={t("songs.chooseKey")}
        description={t("songs.chooseKeyDescription")}
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

      <DiscardChangesDialog
        visible={leaveGuard.confirmVisible}
        what={t("songs.changesToThisSong")}
        onKeepEditing={leaveGuard.keepEditing}
        onDiscard={leaveGuard.discardAndLeave}
      />
    </KeyboardAvoidingView>
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
    host: { flex: 1 },
    flex: { flex: 1, minWidth: 0 },
    body: { paddingTop: Theme.spacing.l },
    formCard: { gap: Theme.spacing.m },
    keyRow: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.s, alignItems: "flex-end" },
    keyField: { flexGrow: 1, minWidth: 150, gap: 6 },
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
    editorBlock: { gap: Theme.spacing.m },
    editorHeader: { gap: 2 },
    detailsHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
    },
    detailsBody: { gap: Theme.spacing.m },
    footer: {
      paddingTop: Theme.spacing.m,
      paddingBottom: Theme.spacing.m,
      borderTopWidth: 1,
      borderTopColor: Theme.colors.border,
      backgroundColor: Theme.colors.chrome,
    },
    footerInner: { width: "100%", alignSelf: "center", gap: Theme.spacing.s },
    keyOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    actions: { flexDirection: "row", gap: Theme.spacing.m },
    action: { flex: 1 },
    pressed: { opacity: 0.7 },
  })

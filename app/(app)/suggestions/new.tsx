import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card, Chip } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { useToast } from "@/components/ui/Toast"
import { ModalScreen } from "@/components/app/ModalScreen"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { createSuggestion } from "@/services/suggestions"
import { toFriendlyError } from "@/services/errors"
import { MAJOR_KEYS, MINOR_KEYS } from "@/libs/chords"
import { validateRequired } from "@/libs/validation"

/**
 * Propose a song the band doesn't have yet (docs §13), as a modal. Accepting the
 * suggestion creates the song with the pasted lyrics parsed into lines.
 */
export default function NewSuggestion() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { profile } = useAuth()
  const { organizationId } = useOrganization()

  const [title, setTitle] = useState("")
  const [artist, setArtist] = useState("")
  const [key, setKey] = useState("C")
  const [lyrics, setLyrics] = useState("")
  const [comment, setComment] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (): Promise<void> => {
    setFormError(null)
    const next: Record<string, string> = {}
    const titleError = validateRequired(title, t("suggestions.titleRequired"))
    if (titleError) next.title = titleError
    if (lyrics.trim().length === 0) next.lyrics = t("suggestions.lyricsRequired")
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    try {
      await createSuggestion(
        organizationId ?? "",
        {
          songId: null,
          songTitle: title.trim(),
          type: "new_song",
          change: { kind: "new_song", title: title.trim(), artist: artist.trim(), key, lyrics },
          summary: `Add "${title.trim()}" to the songbook`,
          comment,
        },
        { id: profile?.uid ?? "", name: profile?.displayName || "A member" },
      )
      toast.showSuccess(t("suggestions.suggestionSentAdmin"))
      router.replace("/suggestions")
    } catch (error) {
      const message = toFriendlyError(error, t("suggestions.couldNotSend"))
      setFormError(message)
      toast.showError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalScreen title={t("suggestions.suggestSong")} subtitle={t("suggestions.newSubtitle")}>
      <Card style={styles.card}>
        <Input
          label={t("songs.songTitle")}
          required
          value={title}
          onChangeText={setTitle}
          placeholder={t("suggestions.titlePlaceholder")}
          error={errors.title}
          autoCapitalize="words"
        />
        <Input
          label={t("songs.artist")}
          value={artist}
          onChangeText={setArtist}
          placeholder={t("suggestions.artistPlaceholder")}
          autoCapitalize="words"
        />

        <View style={styles.field}>
          <AppText variant="caption" tone="muted">
            {t("songs.key")}
          </AppText>
          <View style={styles.wrap}>
            {[...MAJOR_KEYS, ...MINOR_KEYS].map((option) => (
              <Chip
                key={option}
                label={option}
                tone="accent"
                size="sm"
                selected={key === option}
                onPress={() => setKey(option)}
              />
            ))}
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <Input
          label={t("songs.lyrics")}
          required
          value={lyrics}
          onChangeText={setLyrics}
          multiline
          numberOfLines={8}
          placeholder={t("suggestions.lyricsPlaceholder")}
          hint={t("suggestions.lyricsHint")}
          error={errors.lyrics}
        />
        <Input
          label={t("songs.noteForAdmin")}
          value={comment}
          onChangeText={setComment}
          multiline
          placeholder={t("suggestions.notePlaceholder")}
        />
      </Card>

      {formError ? (
        <AppText variant="caption" tone="danger" accessibilityRole="alert">
          {formError}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <Button label={t("common.cancel")} variant="ghost" onPress={() => router.back()} style={styles.action} />
        <Button
          label={t("songs.sendSuggestion")}
          loading={saving}
          onPress={() => void submit()}
          style={styles.action}
        />
      </View>
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.m },
    field: { gap: 6 },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    actions: { flexDirection: "row", gap: Theme.spacing.m },
    action: { flex: 1 },
  })

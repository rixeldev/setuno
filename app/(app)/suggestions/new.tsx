import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card, Chip } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { useToast } from "@/components/ui/Toast"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { createSuggestion } from "@/services/suggestions"
import { toFriendlyError } from "@/services/errors"
import { MAJOR_KEYS, MINOR_KEYS } from "@/libs/chords"
import { validateRequired } from "@/libs/validation"

/**
 * Propose a song the band doesn't have yet (docs §13). Accepting the
 * suggestion creates the song with the pasted lyrics parsed into lines.
 */
export default function NewSuggestion() {
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
    const titleError = validateRequired(title, "What's the song called?")
    if (titleError) next.title = titleError
    if (lyrics.trim().length === 0) next.lyrics = "Paste at least a verse so the admin knows the song."
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
      toast.showSuccess("Suggestion sent. An admin will add it to the songbook.")
      router.replace("/suggestions")
    } catch (error) {
      const message = toFriendlyError(error, "We couldn't send that suggestion.")
      setFormError(message)
      toast.showError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenContainer back title="Suggest a song" subtitle="An admin reviews it before it joins the chord book">
      <Card style={styles.card}>
        <Input
          label="Title"
          required
          value={title}
          onChangeText={setTitle}
          placeholder="Fast Car"
          error={errors.title}
          autoCapitalize="words"
        />
        <Input
          label="Artist"
          value={artist}
          onChangeText={setArtist}
          placeholder="Tracy Chapman"
          autoCapitalize="words"
        />

        <View style={styles.field}>
          <AppText variant="caption" tone="muted">
            Key
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
          label="Lyrics"
          required
          value={lyrics}
          onChangeText={setLyrics}
          multiline
          numberOfLines={8}
          placeholder={"You had a fast car\nI want a fast car"}
          hint="One line per row. The admin can add chords before publishing."
          error={errors.lyrics}
        />
        <Input
          label="Note for the admin"
          value={comment}
          onChangeText={setComment}
          multiline
          placeholder="We play this in A with the capo on 2."
        />
      </Card>

      {formError ? (
        <AppText variant="caption" tone="danger" accessibilityRole="alert">
          {formError}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} style={styles.action} />
        <Button label="Send suggestion" loading={saving} onPress={() => void submit()} style={styles.action} />
      </View>
    </ScreenContainer>
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
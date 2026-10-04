import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { useToast } from "@/components/ui/Toast"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { createOrganization } from "@/services/organizations"
import { toFriendlyError } from "@/services/errors"
import { validateRequired } from "@/libs/validation"

/** Create a new band; the creator becomes its owner and first admin. */
export default function NewOrganization() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { profile, user, updateProfile } = useAuth()
  const { switchOrganization } = useOrganization()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (): Promise<void> => {
    const nameError = validateRequired(name, "Give your band a name.")
    setError(nameError)
    if (nameError) return

    setSaving(true)
    try {
      const id = await createOrganization({
        name: name.trim(),
        description: description.trim(),
        ownerName: profile?.displayName || user?.displayName || "Band admin",
      })
      await switchOrganization(id)
      await updateProfile({ onboarded: true })
      toast.showSuccess(`${name.trim()} is ready.`)
      router.replace("/")
    } catch (err) {
      const message = toFriendlyError(err, "We couldn't create that band.")
      setError(message)
      toast.showError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenContainer back title="New band" subtitle="One account, as many bands as you like" large>
      <Card style={styles.card}>
        <Input
          label="Band name"
          required
          value={name}
          onChangeText={setName}
          placeholder="The Riverside Blues"
          error={error}
          autoCapitalize="words"
        />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Rock covers, Thursday jams…"
          multiline
        />
      </Card>

      <AppText variant="caption" tone="faint">
        You’ll be the owner: you can edit songs, setlists, shows and invite the rest of the band from the members
        screen.
      </AppText>

      <View style={styles.actions}>
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} style={styles.action} />
        <Button label="Create band" loading={saving} onPress={() => void submit()} style={styles.action} />
      </View>
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.m },
    actions: { flexDirection: "row", gap: Theme.spacing.m },
    action: { flex: 1 },
  })
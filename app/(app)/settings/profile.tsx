import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Avatar } from "@/components/ui/Avatar"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Dialog } from "@/components/ui/Dialog"
import { useToast } from "@/components/ui/Toast"
import { AccountIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { toFriendlyError } from "@/services/errors"
import { updateAuthDisplayName, updateAuthPhotoUrl } from "@/services/auth"
import { uploadImage } from "@/services/uploads"
import { validateRequired } from "@/libs/validation"
import { pickImageBase64 } from "@/libs/imagePicker"

/** Profile settings (docs §32): the name and photo the band sees. */
export default function ProfileSettings() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { profile, user, updateProfile } = useAuth()

  const [name, setName] = useState(profile?.displayName || user?.displayName || "")
  const [photoURL, setPhotoURL] = useState<string | null>(profile?.photoURL ?? user?.photoURL ?? null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmRemovePhoto, setConfirmRemovePhoto] = useState(false)

  const choosePhoto = async (): Promise<void> => {
    const picked = await pickImageBase64()
    if (!picked) return

    setUploading(true)
    try {
      const uploaded = await uploadImage("avatars", picked)
      setPhotoURL(uploaded.url)
      await updateAuthPhotoUrl(uploaded.url)
      toast.showSuccess("Photo updated.")
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't upload that photo."))
    } finally {
      setUploading(false)
    }
  }

  const save = async (): Promise<void> => {
    const nameError = validateRequired(name, "Enter the name your band knows you by.")
    setErrors({ ...(nameError ? { name: nameError } : {}) })
    if (nameError) return

    setSaving(true)
    try {
      await updateProfile({ displayName: name.trim(), photoURL })
      await updateAuthDisplayName(name.trim()).catch(() => undefined)
      toast.showSuccess("Your profile was updated.")
      router.back()
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't save your profile."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenContainer back title="Your profile" subtitle="How the band sees you" large>
      <Card style={styles.card}>
        <View style={styles.avatarRow}>
          <Avatar
            name={name || "?"}
            photoURL={photoURL}
            size={72}
            accessibilityLabel={`Profile photo of ${name || "you"}`}
          />
          <View style={styles.flex}>
            <Button
              label={uploading ? "Uploading…" : "Change photo"}
              variant="secondary"
              loading={uploading}
              icon={<AccountIcon size={15} color={Theme.colors.text} />}
              onPress={() => void choosePhoto()}
            />
            {photoURL ? (
              <Button
                label="Remove photo"
                variant="ghost"
                size="sm"
                onPress={() => setConfirmRemovePhoto(true)}
              />
            ) : null}
          </View>
        </View>

        <Input
          label="Display name"
          required
          value={name}
          onChangeText={setName}
          placeholder="Alex Rivera"
          error={errors.name}
          autoCapitalize="words"
        />

        <View style={{ gap: 4 }}>
          <AppText variant="caption" tone="muted">
            Email
          </AppText>
          <AppText variant="body" tone="faint">
            {profile?.email || user?.email || "Not available"}
          </AppText>
          <AppText variant="caption" tone="faint">
            Your sign-in email can’t be changed here.
          </AppText>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} style={styles.action} />
        <Button label="Save profile" loading={saving} onPress={() => void save()} style={styles.action} />
      </View>

      <Dialog
        visible={confirmRemovePhoto}
        onClose={() => setConfirmRemovePhoto(false)}
        title="Remove your photo?"
        description="Your band members will see your initials instead."
        confirmLabel="Remove photo"
        tone="danger"
        onConfirm={async () => {
          setConfirmRemovePhoto(false)
          setPhotoURL(null)
          await updateAuthPhotoUrl("").catch(() => undefined)
        }}
      />
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.m },
    avatarRow: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.l },
    flex: { flex: 1, gap: 6 },
    actions: { flexDirection: "row", gap: Theme.spacing.m },
    action: { flex: 1 },
  })
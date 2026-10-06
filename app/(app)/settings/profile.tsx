import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

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
import { ModalScreen } from "@/components/app/ModalScreen"
import { useAuth } from "@/hooks/useAuth"
import { toFriendlyError } from "@/services/errors"
import { updateAuthDisplayName, updateAuthPhotoUrl } from "@/services/auth"
import { changeUsername, isUsernameTaken } from "@/services/usernames"
import { uploadImage } from "@/services/uploads"
import { validateRequired } from "@/libs/validation"
import { canChangeUsername, normalizeUsername } from "@/libs/username"
import { pickImageBase64 } from "@/libs/imagePicker"
import { toDate } from "@/interfaces/timestamp"

/** Profile settings (docs §32): the name and photo the band sees. */
export default function ProfileSettings() {
  const { t } = useTranslation()
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
      toast.showSuccess(t("settings.photoUpdated"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("settings.couldNotUploadPhoto")))
    } finally {
      setUploading(false)
    }
  }

  const save = async (): Promise<void> => {
    const nameError = validateRequired(name, t("auth.nameHint"))
    if (nameError) {
      setErrors({ name: nameError })
      return
    }
    setErrors({})

    const normalized = normalizeUsername(name)
    const current = normalizeUsername(profile?.displayName ?? "")
    const nameChanged = normalized !== current
    const lastChangedMs = profile?.usernameChangedAt
      ? (toDate(profile.usernameChangedAt)?.getTime() ?? null)
      : null

    setSaving(true)
    try {
      if (nameChanged) {
        // Feedback instead of a failed write: cooldown, then availability.
        if (!canChangeUsername(lastChangedMs, Date.now())) {
          setErrors({ name: t("settings.usernameTooSoon") })
          return
        }
        if (await isUsernameTaken(normalized)) {
          setErrors({ name: t("settings.usernameTaken") })
          return
        }
        if (profile?.uid) {
          await changeUsername(profile.uid, current, normalized)
        }
      }
      await updateProfile({ displayName: normalized, photoURL })
      await updateAuthDisplayName(normalized).catch(() => undefined)
      toast.showSuccess(t("settings.profileUpdated"))
      router.back()
    } catch (error) {
      toast.showError(toFriendlyError(error, t("settings.couldNotSaveProfile")))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalScreen title={t("settings.yourProfile")} subtitle={t("settings.profileSubtitle")}>
      <Card style={styles.card}>
        <View style={styles.avatarRow}>
          <Avatar
            name={name || "?"}
            photoURL={photoURL}
            size={72}
            accessibilityLabel={t("settings.photoA11y", { name: name || t("common.you") })}
          />
          <View style={styles.flex}>
            <Button
              label={uploading ? t("settings.uploading") : t("settings.changePhoto")}
              variant="secondary"
              loading={uploading}
              icon={<AccountIcon size={15} color={Theme.colors.text} />}
              onPress={() => void choosePhoto()}
            />
            {photoURL ? (
              <Button
                label={t("settings.removePhoto")}
                variant="ghost"
                size="sm"
                onPress={() => setConfirmRemovePhoto(true)}
              />
            ) : null}
          </View>
        </View>

        <Input
          label={t("settings.displayName")}
          required
          value={name}
          onChangeText={setName}
          placeholder={t("settings.displayNamePlaceholder")}
          hint={t("settings.usernameHint")}
          error={errors.name}
          autoCapitalize="words"
        />

        <View style={{ gap: 4 }}>
          <AppText variant="caption" tone="muted">
            {t("settings.email")}
          </AppText>
          <AppText variant="body" tone="faint">
            {profile?.email || user?.email || t("common.notAvailable")}
          </AppText>
          <AppText variant="caption" tone="faint">
            {t("settings.emailNote")}
          </AppText>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          label={t("common.cancel")}
          variant="ghost"
          onPress={() => router.back()}
          style={styles.action}
        />
        <Button
          label={t("settings.saveProfile")}
          loading={saving}
          onPress={() => void save()}
          style={styles.action}
        />
      </View>

      <Dialog
        visible={confirmRemovePhoto}
        onClose={() => setConfirmRemovePhoto(false)}
        title={t("settings.removePhotoTitle")}
        description={t("settings.removePhotoDescription")}
        confirmLabel={t("settings.removePhoto")}
        tone="danger"
        onConfirm={async () => {
          setConfirmRemovePhoto(false)
          setPhotoURL(null)
          await updateAuthPhotoUrl("").catch(() => undefined)
        }}
      />
    </ModalScreen>
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
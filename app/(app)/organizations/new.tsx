import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { useToast } from "@/components/ui/Toast"
import { ModalScreen } from "@/components/app/ModalScreen"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { createOrganization } from "@/services/organizations"
import { toFriendlyError } from "@/services/errors"
import { validateRequired } from "@/libs/validation"

/** Create a new band; the creator becomes its owner and first admin. */
export default function NewOrganization() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { profile, user, updateProfile } = useAuth()
  const { switchOrganization } = useOrganization()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const close = (): void => {
    if (router.canGoBack()) router.back()
    else router.replace("/")
  }

  const submit = async (): Promise<void> => {
    const nameError = validateRequired(name, t("auth.giveBandName"))
    setError(nameError)
    if (nameError) return

    setSaving(true)
    try {
      const id = await createOrganization({
        name: name.trim(),
        description: description.trim(),
        ownerName: profile?.displayName || user?.displayName || "Band admin",
        ownerEmail: profile?.email || user?.email || "",
        ownerPhotoURL: profile?.photoURL ?? user?.photoURL ?? null,
      })
      await switchOrganization(id)
      await updateProfile({ onboarded: true })
      toast.showSuccess(t("auth.bandReady", { name: name.trim() }))
      close()
    } catch (err) {
      const message = toFriendlyError(err, t("auth.couldNotCreateBand"))
      setError(message)
      toast.showError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalScreen
      title={t("organizations.newBand")}
      subtitle={t("auth.signUpSubtitle")}
      onClose={close}
    >
      <Card style={styles.card}>
        <Input
          label={t("organizations.bandName")}
          required
          value={name}
          onChangeText={setName}
          placeholder={t("organizations.bandNamePlaceholder")}
          error={error}
          autoCapitalize="words"
        />
        <Input
          label={t("organizations.bandDescription")}
          value={description}
          onChangeText={setDescription}
          placeholder={t("organizations.bandDescriptionPlaceholder")}
          multiline
        />
      </Card>

      <AppText variant="caption" tone="faint">
        {t("organizations.ownerNote")}
      </AppText>

      <View style={styles.actions}>
        <Button label={t("common.cancel")} variant="ghost" onPress={close} style={styles.action} />
        <Button
          label={t("organizations.createBand")}
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
    actions: { flexDirection: "row", gap: Theme.spacing.m },
    action: { flex: 1 },
  })

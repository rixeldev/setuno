import React, { useState } from "react"
import { Image, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Dialog } from "@/components/ui/Dialog"
import { useToast } from "@/components/ui/Toast"
import { OrganizationIcon } from "@/components/ui/Icons"
import { ModalScreen } from "@/components/app/ModalScreen"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { deleteOrganization, updateOrganization } from "@/services/organizations"
import { toFriendlyError } from "@/services/errors"
import { uploadImage } from "@/services/uploads"
import { pickImageBase64 } from "@/libs/imagePicker"
import { validateRequired } from "@/libs/validation"
import { formatDate } from "@/libs/format"
import { toDate } from "@/interfaces/timestamp"

/** Band settings (docs §31): rename, describe, logo, danger zone (admins only). */
export default function OrganizationSettings() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { profile } = useAuth()
  const { organization, organizationId, isAdmin, role, organizations, switchOrganization, refresh } = useOrganization()
  const { members, songs, setlists, performances } = useOrgData()

  const [name, setName] = useState(organization?.name ?? "")
  const [description, setDescription] = useState(organization?.description ?? "")
  const [logoURL, setLogoURL] = useState<string | null>(organization?.logoURL ?? null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [typedName, setTypedName] = useState("")

  const actor = { id: profile?.uid ?? "", name: profile?.displayName || "An admin" }
  const isOwner = organization?.ownerId === profile?.uid
  const deletionPhrase = organization?.name ?? ""

  /** Closes the modal, falling back to the dashboard when opened at the root. */
  const close = (): void => {
    if (router.canGoBack()) router.back()
    else router.replace("/")
  }

  const chooseLogo = async (): Promise<void> => {
    const picked = await pickImageBase64()
    if (!picked) return
    setUploading(true)
    try {
      const uploaded = await uploadImage("organizations", picked)
      setLogoURL(uploaded.url)
      await updateOrganization(organizationId ?? "", { name: organization?.name ?? "", description: organization?.description ?? "", logoURL: uploaded.url }, actor)
      toast.showSuccess(t("organizations.logoUpdated"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("settings.couldNotUploadLogo")))
    } finally {
      setUploading(false)
    }
  }

  const save = async (): Promise<void> => {
    const nameError = validateRequired(name, t("auth.giveBandName"))
    setErrors({ ...(nameError ? { name: nameError } : {}) })
    if (nameError) return

    setSaving(true)
    try {
      await updateOrganization(
        organizationId ?? "",
        { name: name.trim(), description: description.trim(), logoURL },
        actor,
      )
      toast.showSuccess(t("organizations.updated"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("settings.couldNotSaveBand")))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (): Promise<void> => {
    setSaving(true)
    try {
      const fallback = organizations.find((entry) => entry.id !== organizationId)
      await deleteOrganization(organizationId ?? "")
      setConfirmDelete(false)
      toast.showSuccess(t("organizations.deleted"))
      if (fallback) {
        // Switch before closing so the app never keeps pointing at the band
        // that was just deleted. The provider state flips first, so a failed
        // preference write must not keep the modal (with its stale form) open.
        await switchOrganization(fallback.id).catch(() => undefined)
        close()
      } else {
        await refresh()
        router.replace("/organizations")
      }
    } catch (error) {
      toast.showError(toFriendlyError(error, t("settings.couldNotDeleteBand")))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalScreen title={t("settings.bandDetails")} subtitle={organization?.name}>
      <Card style={styles.card}>
        <AppText variant="label" tone="faint">
          {t("organizations.bandLogo")}
        </AppText>
        <View style={styles.logoRow}>
          {logoURL ? (
            <Image
              source={{ uri: logoURL }}
              style={styles.logoImage}
              accessibilityLabel={t("settings.logoA11y", {
                name: organization?.name ?? t("organizations.band"),
              })}
            />
          ) : (
            <View style={[styles.logo, styles.logoEmpty]}>
              <OrganizationIcon size={22} color={Theme.colors.textFaint} />
            </View>
          )}
          <View style={styles.flex}>
            <Button
              label={
                uploading
                  ? t("settings.uploading")
                  : logoURL
                    ? t("settings.replaceLogo")
                    : t("settings.uploadLogo")
              }
              variant="secondary"
              loading={uploading}
              disabled={!isAdmin}
              onPress={() => void chooseLogo()}
            />
            <AppText variant="caption" tone="faint">
              {t("settings.logoHint")}
            </AppText>
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <Input
          label={t("organizations.bandName")}
          required
          value={name}
          onChangeText={setName}
          editable={isAdmin}
          error={errors.name}
          autoCapitalize="words"
        />
        <Input
          label={t("organizations.bandDescription")}
          value={description}
          onChangeText={setDescription}
          editable={isAdmin}
          multiline
          placeholder={t("organizations.bandDescriptionPlaceholder")}
        />
        {isAdmin ? (
          <Button label={t("settings.saveDetails")} loading={saving} onPress={() => void save()} />
        ) : (
          <AppText variant="caption" tone="faint">
            {t("settings.adminOnlyBand")}
          </AppText>
        )}
      </Card>

      <Card style={styles.card}>
        <AppText variant="label" tone="faint">
          {t("settings.atAGlance")}
        </AppText>
        <AppText variant="caption" tone="muted">
          {t("organizations.membersCount", { count: members.length })} ·{" "}
          {t("organizations.songsCount", { count: songs.length })} ·{" "}
          {t("organizations.setlistsCount", { count: setlists.length })} ·{" "}
          {t("organizations.showsCount", { count: performances.length })}
        </AppText>
        <AppText variant="caption" tone="faint">
          {t("settings.createdRole", {
            date: formatDate(toDate(organization?.createdAt ?? null)),
            role: t(`organizations.${role ?? "member"}`).toLowerCase(),
          })}
        </AppText>
      </Card>

      {isAdmin && isOwner ? (
        <Card style={[styles.card, styles.dangerCard]}>
          <AppText variant="label" tone="danger">
            {t("settings.dangerZone")}
          </AppText>
          <AppText variant="caption" tone="muted">
            {t("organizations.deleteBandDescription", { phrase: deletionPhrase })}
          </AppText>
          <Button
            label={t("organizations.deleteBand")}
            variant="danger"
            onPress={() => {
              setTypedName("")
              setConfirmDelete(true)
            }}
          />
        </Card>
      ) : null}

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("organizations.deleteBandConfirm", { name: deletionPhrase })}
        description={t("settings.deleteConfirmDescription", { name: deletionPhrase })}
        confirmLabel={t("organizations.deleteBand")}
        tone="danger"
        confirmDisabled={typedName.trim() !== deletionPhrase.trim()}
        confirmLoading={saving}
        onConfirm={() => void remove()}
      >
        <Input
          label={t("organizations.bandName")}
          value={typedName}
          onChangeText={setTypedName}
          placeholder={deletionPhrase}
          autoCapitalize="words"
        />
      </Dialog>
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.m },
    logoRow: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    logo: {
      width: 56,
      height: 56,
      borderRadius: Theme.radii.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.primary,
    },
    logoEmpty: { backgroundColor: Theme.colors.background2 },
    logoImage: { width: 56, height: 56, borderRadius: Theme.radii.lg },
    flex: { flex: 1, gap: 6 },
    dangerCard: { borderColor: Theme.colors.danger },
  })
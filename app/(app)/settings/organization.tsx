import React, { useState } from "react"
import { Image, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Dialog } from "@/components/ui/Dialog"
import { useToast } from "@/components/ui/Toast"
import { OrganizationIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { deleteOrganization, updateOrganization } from "@/services/organizations"
import { toFriendlyError } from "@/services/errors"
import { uploadImage } from "@/services/uploads"
import { pickImageBase64 } from "@/libs/imagePicker"
import { validateRequired } from "@/libs/validation"
import { formatDate, pluralize } from "@/libs/format"
import { toDate } from "@/interfaces/timestamp"
import { ROLE_LABELS } from "@/interfaces"

/** Band settings (docs §31): rename, describe, logo, danger zone (admins only). */
export default function OrganizationSettings() {
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

  const chooseLogo = async (): Promise<void> => {
    const picked = await pickImageBase64()
    if (!picked) return
    setUploading(true)
    try {
      const uploaded = await uploadImage("organizations", picked)
      setLogoURL(uploaded.url)
      await updateOrganization(organizationId ?? "", { name: organization?.name ?? "", description: organization?.description ?? "", logoURL: uploaded.url }, actor)
      toast.showSuccess("Logo updated.")
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't upload that logo."))
    } finally {
      setUploading(false)
    }
  }

  const save = async (): Promise<void> => {
    const nameError = validateRequired(name, "Your band needs a name.")
    setErrors({ ...(nameError ? { name: nameError } : {}) })
    if (nameError) return

    setSaving(true)
    try {
      await updateOrganization(
        organizationId ?? "",
        { name: name.trim(), description: description.trim(), logoURL },
        actor,
      )
      toast.showSuccess("Band details saved.")
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't save those details."))
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
      toast.showSuccess(`${deletionPhrase} was deleted.`)
      if (fallback) {
        await switchOrganization(fallback.id)
      } else {
        await refresh()
        router.replace("/organizations")
      }
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't delete that band."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenContainer back title="Band details" subtitle={organization?.name} large>
      <Card style={styles.card}>
        <AppText variant="label" tone="faint">
          Logo
        </AppText>
        <View style={styles.logoRow}>
          {logoURL ? (
            <Image
              source={{ uri: logoURL }}
              style={styles.logoImage}
              accessibilityLabel={`${organization?.name ?? "Band"} logo`}
            />
          ) : (
            <View style={[styles.logo, styles.logoEmpty]}>
              <OrganizationIcon size={22} color={Theme.colors.textFaint} />
            </View>
          )}
          <View style={styles.flex}>
            <Button
              label={uploading ? "Uploading…" : logoURL ? "Replace logo" : "Upload a logo"}
              variant="secondary"
              loading={uploading}
              disabled={!isAdmin}
              onPress={() => void chooseLogo()}
            />
            <AppText variant="caption" tone="faint">
              Square images work best.
            </AppText>
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <Input
          label="Band name"
          required
          value={name}
          onChangeText={setName}
          editable={isAdmin}
          error={errors.name}
          autoCapitalize="words"
        />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          editable={isAdmin}
          multiline
          placeholder="Rock covers, Thursday jams…"
        />
        {isAdmin ? (
          <Button label="Save details" loading={saving} onPress={() => void save()} />
        ) : (
          <AppText variant="caption" tone="faint">
            Only admins can change the band name and logo.
          </AppText>
        )}
      </Card>

      <Card style={styles.card}>
        <AppText variant="label" tone="faint">
          At a glance
        </AppText>
        <AppText variant="caption" tone="muted">
          {pluralize(members.length, "member")} · {pluralize(songs.length, "song")} ·{" "}
          {pluralize(setlists.length, "setlist")} · {pluralize(performances.length, "show")}
        </AppText>
        <AppText variant="caption" tone="faint">
          Created {formatDate(toDate(organization?.createdAt ?? null))} · your role is{" "}
          {ROLE_LABELS[role ?? "member"].toLowerCase()}
        </AppText>
      </Card>

      {isAdmin && isOwner ? (
        <Card style={[styles.card, styles.dangerCard]}>
          <AppText variant="label" tone="danger">
            Danger zone
          </AppText>
          <AppText variant="caption" tone="muted">
            Deleting {deletionPhrase} removes every song, setlist, show and suggestion for the whole band. This
            can’t be undone.
          </AppText>
          <Button
            label="Delete this band"
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
        title={`Delete ${deletionPhrase}?`}
        description={`Type ${deletionPhrase} to confirm. Every song, setlist and show is deleted for everyone.`}
        confirmLabel="Delete band"
        tone="danger"
        confirmDisabled={typedName.trim() !== deletionPhrase.trim()}
        confirmLoading={saving}
        onConfirm={() => void remove()}
      >
        <Input
          label="Band name"
          value={typedName}
          onChangeText={setTypedName}
          placeholder={deletionPhrase}
          autoCapitalize="words"
        />
      </Dialog>
    </ScreenContainer>
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
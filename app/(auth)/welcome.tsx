import React, { useState } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { AppText } from "@/components/ui/AppText"
import { Card, Badge } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { UsersIcon } from "@/components/ui/Icons"
import { AuthLayout } from "@/components/app/AuthLayout"
import { useToast } from "@/components/ui/Toast"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { acceptInvitation, createOrganization } from "@/services/organizations"
import { toFriendlyError } from "@/services/errors"
import { validateRequired } from "@/libs/validation"
import type { Invitation } from "@/interfaces"

/**
 * Onboarding for signed-in users without a band: create one or accept a pending
 * invitation (docs §7, §43).
 */
export default function Welcome() {
  const router = useRouter()
  const { t } = useTranslation()
  const toast = useToast()
  const { profile, user, updateProfile } = useAuth()
  const { invitations, switchOrganization } = useOrganization()
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingAccept, setPendingAccept] = useState<Invitation | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ name: string; description: string }>({ defaultValues: { name: "", description: "" } })

  const finish = async (organizationId: string): Promise<void> => {
    await switchOrganization(organizationId)
    await updateProfile({ onboarded: true })
    router.replace("/(app)")
  }

  const onCreate = handleSubmit(async (values) => {
    setFormError(null)
    setBusy(true)
    try {
      const organizationId = await createOrganization({
        name: values.name,
        description: values.description,
        ownerName: profile?.displayName || user?.displayName || "Band admin",
      })
      reset({ name: "", description: "" })
      toast.showSuccess(t("auth.bandReady", { name: values.name }))
      await finish(organizationId)
    } catch (error) {
      setFormError(toFriendlyError(error, t("auth.couldNotCreateBand")))
    } finally {
      setBusy(false)
    }
  })

  const accept = async (invitation: Invitation): Promise<void> => {
    setBusy(true)
    try {
      await acceptInvitation(invitation, {
        displayName: profile?.displayName || user?.displayName || "",
        photoURL: profile?.photoURL ?? user?.photoURL ?? null,
        email: profile?.email || user?.email || "",
      })
      setPendingAccept(null)
      toast.showSuccess(t("auth.welcomeToBand", { name: invitation.organizationName }))
      await finish(invitation.organizationId)
    } catch (error) {
      toast.showError(toFriendlyError(error, t("auth.couldNotJoinBand")))
    } finally {
      setBusy(false)
    }
  }

  const displayName = profile?.displayName || user?.displayName

  return (
    <AuthLayout
      title={displayName ? t("auth.hiName", { name: displayName.split(" ")[0] }) : t("auth.welcome")}
      subtitle={t("auth.welcomeIntro")}
    >
      {invitations.length > 0 ? (
        <ViewWelcome invitations={invitations} onAccept={setPendingAccept} busy={busy} />
      ) : (
        <Card style={{ gap: Theme.spacing.s }}>
          <UsersIcon size={22} color={Theme.colors.primary} />
          <AppText variant="subheading">{t("auth.noInvitations")}</AppText>
          <AppText variant="caption" tone="muted">
            {t("auth.noInvitationsHint")}
          </AppText>
        </Card>
      )}

      <AppText variant="label" tone="faint">
        {t("auth.orCreateBand")}
      </AppText>

      <Input
        label={t("organizations.bandName")}
        required
        placeholder="The Riverside Blues"
        autoCapitalize="words"
        error={errors.name?.message}
        {...register("name", {
          validate: (value) => validateRequired(value, t("auth.giveBandName")) ?? true,
        })}
      />

      <Input
        label={t("organizations.bandDescription")}
        placeholder={t("organizations.descriptionPlaceholder")}
        multiline
        {...register("description")}
      />

      {formError ? (
        <AppText variant="caption" tone="danger" accessibilityRole="alert">
          {formError}
        </AppText>
      ) : null}

      <Button label={t("organizations.createBand")} full size="lg" loading={busy} onPress={() => void onCreate()} />

      <Button
        label={t("auth.signOut")}
        variant="ghost"
        full
        onPress={() => router.replace("/(auth)/sign-in")}
      />

      <Dialog
        visible={pendingAccept !== null}
        onClose={() => setPendingAccept(null)}
        title={
          pendingAccept
            ? t("auth.joinBandTitle", { name: pendingAccept.organizationName })
            : t("auth.joinBandTitle", { name: "" })
        }
        description={t("auth.joinBandDescription", {
          role: pendingAccept?.role === "admin" ? t("auth.roleAdmin") : t("auth.roleMusician"),
        })}
        confirmLabel={t("auth.acceptInvitation")}
        confirmLoading={busy}
        onConfirm={() => {
          if (pendingAccept) void accept(pendingAccept)
        }}
      />
    </AuthLayout>
  )
}

/** Pending invitation cards shown on top of the onboarding form. */
function ViewWelcome({
  invitations,
  onAccept,
  busy,
}: {
  invitations: Invitation[]
  onAccept: (invitation: Invitation) => void
  busy: boolean
}) {
  const { t } = useTranslation()
  if (invitations.length === 0) return null

  return (
    <>
      <AppText variant="label" tone="faint">
        {t("auth.invitationsForYou")}
      </AppText>
      {invitations.map((invitation) => (
        <Card key={invitation.id} style={{ gap: Theme.spacing.m }}>
          <View>
            <AppText variant="subheading">{invitation.organizationName || t("auth.anonymousBand")}</AppText>
            <AppText variant="caption" tone="muted">
              {t("auth.invitedBy", { name: invitation.invitedByName || t("organizations.admin") })}
            </AppText>
          </View>
          <View style={{ flexDirection: "row", gap: Theme.spacing.s, alignItems: "center" }}>
            <Badge
              label={invitation.role === "admin" ? t("organizations.admin") : t("auth.musician")}
              tone="primary"
            />
          </View>
          <Button
            label={t("auth.acceptInvitation")}
            disabled={busy}
            onPress={() => onAccept(invitation)}
          />
        </Card>
      ))}
    </>
  )
}
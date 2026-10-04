import React, { useState } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"
import { useForm } from "react-hook-form"

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
      toast.showSuccess(`${values.name} is ready. Add your songs to get started.`)
      await finish(organizationId)
    } catch (error) {
      setFormError(toFriendlyError(error, "We couldn't create that band. Please try again."))
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
      toast.showSuccess(`Welcome to ${invitation.organizationName}.`)
      await finish(invitation.organizationId)
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't join that band. Please try again."))
    } finally {
      setBusy(false)
    }
  }

  const displayName = profile?.displayName || user?.displayName

  return (
    <AuthLayout
      title={displayName ? `Hi ${displayName.split(" ")[0]}, let's set you up` : "Welcome to Stage Book"}
      subtitle="Every song, setlist and gig lives inside a band. Create one, or join one you've been invited to."
    >
      {invitations.length > 0 ? (
        <ViewWelcome invitations={invitations} onAccept={setPendingAccept} busy={busy} />
      ) : (
        <Card style={{ gap: Theme.spacing.s }}>
          <UsersIcon size={22} color={Theme.colors.primary} />
          <AppText variant="subheading">You have no pending invitations</AppText>
          <AppText variant="caption" tone="muted">
            When a band admin invites you by email, the invitation shows up here.
          </AppText>
        </Card>
      )}

      <AppText variant="label" tone="faint">
        Or create a band
      </AppText>

      <Input
        label="Band name"
        required
        placeholder="The Riverside Blues"
        autoCapitalize="words"
        error={errors.name?.message}
        {...register("name", {
          validate: (value) => validateRequired(value, "Give your band a name.") ?? true,
        })}
      />

      <Input
        label="Description"
        placeholder="Rock covers, Thursday jams…"
        multiline
        {...register("description")}
      />

      {formError ? (
        <AppText variant="caption" tone="danger" accessibilityRole="alert">
          {formError}
        </AppText>
      ) : null}

      <Button label="Create band" full size="lg" loading={busy} onPress={() => void onCreate()} />

      <Button label="Sign out" variant="ghost" full onPress={() => router.replace("/(auth)/sign-in")} />

      <Dialog
        visible={pendingAccept !== null}
        onClose={() => setPendingAccept(null)}
        title={pendingAccept ? `Join ${pendingAccept.organizationName}?` : "Join band"}
        description={`You'll join as ${pendingAccept?.role === "admin" ? "an admin" : "a musician"}. You can leave later from settings.`}
        confirmLabel="Join band"
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
  if (invitations.length === 0) return null

  return (
    <>
      <AppText variant="label" tone="faint">
        Invitations for you
      </AppText>
      {invitations.map((invitation) => (
        <Card key={invitation.id} style={{ gap: Theme.spacing.m }}>
          <View>
            <AppText variant="subheading">{invitation.organizationName || "A band"}</AppText>
            <AppText variant="caption" tone="muted">
              Invited by {invitation.invitedByName || "an admin"}
            </AppText>
          </View>
          <View style={{ flexDirection: "row", gap: Theme.spacing.s, alignItems: "center" }}>
            <Badge label={invitation.role === "admin" ? "Admin" : "Musician"} tone="primary" />
          </View>
          <Button
            label="Accept invitation"
            disabled={busy}
            onPress={() => onAccept(invitation)}
          />
        </Card>
      ))}
    </>
  )
}
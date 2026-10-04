import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card, Section } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import { CheckCircleIcon, PlusIcon, UserIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { acceptInvitation } from "@/services/organizations"
import { toFriendlyError } from "@/services/errors"
import { pluralize } from "@/libs/format"
import type { Invitation } from "@/interfaces"

/** Band switcher (docs §7): switch, join an invitation or create a band. */
export default function OrganizationsScreen() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { profile, user } = useAuth()
  const { organizations, organizationId, invitations, switchOrganization } = useOrganization()

  const [switching, setSwitching] = useState<string | null>(null)
  const [accepting, setAccepting] = useState<Invitation | null>(null)
  const [busy, setBusy] = useState(false)

  const choose = async (id: string): Promise<void> => {
    if (id === organizationId) return
    setSwitching(id)
    try {
      await switchOrganization(id)
      toast.showSuccess("Band switched.")
      router.replace("/")
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't switch bands."))
    } finally {
      setSwitching(null)
    }
  }

  const accept = async (invitation: Invitation): Promise<void> => {
    setBusy(true)
    try {
      await acceptInvitation(invitation, {
        displayName: profile?.displayName || user?.displayName || "",
        photoURL: profile?.photoURL ?? user?.photoURL ?? null,
        email: profile?.email || user?.email || "",
      })
      setAccepting(null)
      toast.showSuccess(`Welcome to ${invitation.organizationName}.`)
      await switchOrganization(invitation.organizationId)
      router.replace("/")
    } catch (error) {
      toast.showError(toFriendlyError(error, "We couldn't join that band."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenContainer
      back
      title="Your bands"
      subtitle={pluralize(organizations.length, "band")}
      large
      headerRight={
        <IconButton
          label="Create a band"
          variant="secondary"
          onPress={() => router.push("/organizations/new")}
          icon={<PlusIcon size={18} color={Theme.colors.text} />}
        />
      }
    >
      {organizations.length === 0 ? (
        <EmptyState
          icon={<UserIcon size={24} color={Theme.colors.primary} />}
          title="You're not in a band yet"
          message="Create one and start typing your songs, or accept an invitation below."
          actionLabel="Create a band"
          onAction={() => router.push("/organizations/new")}
        />
      ) : (
        <View style={styles.list}>
          {organizations.map((organization) => {
            const active = organization.id === organizationId
            return (
              <Card
                key={organization.id}
                onPress={() => void choose(organization.id)}
                accessibilityLabel={`${organization.name}${active ? ", current band" : ""}`}
                style={styles.row}
              >
                <View style={styles.initial}>
                  <AppText variant="subheading" tone="primary">
                    {organization.name.trim().charAt(0).toUpperCase() || "B"}
                  </AppText>
                </View>

                <View style={styles.flex}>
                  <AppText variant="subheading" numberOfLines={1}>
                    {organization.name}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {organization.role === "admin" ? "You're an admin" : "Member"}
                  </AppText>
                </View>
                {active ? (
                  <Badge label="Current" tone="primary" />
                ) : (
                  <Button
                    label={switching === organization.id ? "Switching…" : "Switch"}
                    size="sm"
                    variant="secondary"
                    disabled={switching !== null}
                    onPress={() => void choose(organization.id)}
                  />
                )}
              </Card>
            )
          })}
        </View>
      )}

      {invitations.length > 0 ? (
        <Section title="Invitations for you" subtitle="Join another band with one tap">
          {invitations.map((invitation) => (
            <Card key={invitation.id} style={{ gap: Theme.spacing.m }}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {invitation.organizationName}
              </AppText>
              <AppText variant="caption" tone="muted">
                Invited by {invitation.invitedByName || "an admin"} ·{" "}
                {invitation.role === "admin" ? "as an admin" : "as a member"}
              </AppText>
              <Button
                label="Accept invitation"
                icon={<CheckCircleIcon size={16} color={Theme.colors.onPrimary} />}
                disabled={busy}
                onPress={() => setAccepting(invitation)}
              />
            </Card>
          ))}
        </Section>
      ) : null}

      <Button
        label="Create another band"
        variant="secondary"
        icon={<PlusIcon size={16} color={Theme.colors.text} />}
        onPress={() => router.push("/organizations/new")}
      />

      <Dialog
        visible={accepting !== null}
        onClose={() => setAccepting(null)}
        title={accepting ? `Join ${accepting.organizationName}?` : "Join band"}
        description={`You'll join as ${accepting?.role === "admin" ? "an admin" : "a musician"}.`}
        confirmLabel="Join band"
        confirmLoading={busy}
        onConfirm={() => {
          if (accepting) void accept(accepting)
        }}
      />
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    list: { gap: Theme.spacing.m },
    row: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    initial: {
      width: 40,
      height: 40,
      borderRadius: Theme.radii.m,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.primarySoft,
    },
    flex: { flex: 1, minWidth: 0 },
  })
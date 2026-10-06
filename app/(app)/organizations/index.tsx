import React, { useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card, Section } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import { CheckCircleIcon, ChevronRightIcon, PlusIcon, UserIcon } from "@/components/ui/Icons"
import { ModalScreen } from "@/components/app/ModalScreen"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { acceptInvitation } from "@/services/organizations"
import { toFriendlyError } from "@/services/errors"
import type { Invitation } from "@/interfaces"

/** Band switcher (docs §7): switch, join an invitation or create a band. */
export default function OrganizationsScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { profile, user } = useAuth()
  const { organizations, organizationId, invitations, switchOrganization } = useOrganization()

  const [switching, setSwitching] = useState<string | null>(null)
  const [accepting, setAccepting] = useState<Invitation | null>(null)
  const [busy, setBusy] = useState(false)

  /** Closes the modal, falling back to the dashboard when opened at the root. */
  const close = (): void => {
    if (router.canGoBack()) router.back()
    else router.replace("/")
  }

  const choose = async (id: string): Promise<void> => {
    if (id === organizationId || switching !== null) return
    setSwitching(id)
    try {
      await switchOrganization(id)
      toast.showSuccess(t("organizations.bandSwitched"))
      close()
    } catch (error) {
      toast.showError(toFriendlyError(error, t("organizations.couldNotSwitch")))
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
      toast.showSuccess(t("auth.welcomeToBand", { name: invitation.organizationName }))
      await switchOrganization(invitation.organizationId)
      close()
    } catch (error) {
      toast.showError(toFriendlyError(error, t("auth.couldNotJoinBand")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalScreen
      title={t("organizations.yourBands")}
      subtitle={t("organizations.bandsCount", { count: organizations.length })}
      onClose={close}
      headerRight={
        organizations.length > 0 ? (
          <IconButton
            label={t("organizations.createBand")}
            variant="secondary"
            onPress={() => router.push("/organizations/new")}
            icon={<PlusIcon size={18} color={Theme.colors.text} />}
          />
        ) : null
      }
    >
      {organizations.length === 0 ? (
        <EmptyState
          icon={<UserIcon size={24} color={Theme.colors.primary} />}
          title={t("organizations.noBandsTitle")}
          message={t("organizations.noBandsDescription")}
          actionLabel={t("organizations.createBand")}
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
                accessibilityLabel={`${organization.name}${active ? `, ${t("organizations.currentBand")}` : ""}`}
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
                    {organization.role === "admin" ? t("organizations.youreAdmin") : t("organizations.member")}
                  </AppText>
                </View>
                {active ? (
                  <Badge label={t("organizations.current")} tone="primary" />
                ) : switching === organization.id ? (
                  <ActivityIndicator color={Theme.colors.primary} />
                ) : (
                  <ChevronRightIcon size={18} color={Theme.colors.textFaint} />
                )}
              </Card>
            )
          })}
        </View>
      )}

      {invitations.length > 0 ? (
        <Section title={t("auth.invitationsForYou")} subtitle={t("organizations.joinWithOneTap")}>
          {invitations.map((invitation) => (
            <Card key={invitation.id} style={{ gap: Theme.spacing.m }}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {invitation.organizationName}
              </AppText>
              <AppText variant="caption" tone="muted">
                {t("auth.invitedBy", { name: invitation.invitedByName || t("common.unknownAdmin") })} ·{" "}
                {invitation.role === "admin" ? t("organizations.asAdmin") : t("organizations.asMember")}
              </AppText>
              <Button
                label={t("auth.acceptInvitation")}
                icon={<CheckCircleIcon size={16} color={Theme.colors.onPrimary} />}
                disabled={busy}
                onPress={() => setAccepting(invitation)}
              />
            </Card>
          ))}
        </Section>
      ) : null}

      <Dialog
        visible={accepting !== null}
        onClose={() => setAccepting(null)}
        title={accepting ? t("auth.joinBandTitle", { name: accepting.organizationName }) : t("organizations.joinBand")}
        description={t("auth.joinBandDescription", {
          role: accepting?.role === "admin" ? t("auth.roleAdmin") : t("auth.roleMusician"),
        })}
        confirmLabel={t("organizations.joinBand")}
        confirmLoading={busy}
        onConfirm={() => {
          if (accepting) void accept(accepting)
        }}
      />
    </ModalScreen>
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

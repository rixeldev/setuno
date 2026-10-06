import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Avatar } from "@/components/ui/Avatar"
import { Badge, Card, Chip, Section } from "@/components/ui/Card"
import { IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import { CloseIcon, EmailIcon, GroupIcon, PlusIcon, ShieldCheckIcon, TrashIcon } from "@/components/ui/Icons"
import { ModalScreen } from "@/components/app/ModalScreen"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { addMemberByEmail, removeMember, revokeInvitation, updateMemberRole } from "@/services/organizations"
import { toFriendlyError } from "@/services/errors"
import { formatRelativeTime } from "@/libs/format"
import { toDate } from "@/interfaces/timestamp"
import { validateEmail } from "@/libs/validation"
import type { OrganizationMember, OrganizationRole } from "@/interfaces"

/**
 * Members and invitations (docs §7, §18): admins invite by email, change roles
 * and remove people; everyone can see who is in the band.
 */
export default function MembersScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const toast = useToast()
  const { profile } = useAuth()
  const { organizationId, organization, isAdmin, role } = useOrganization()
  const { members, invitations, loading, error } = useOrgData()

  const [email, setEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("member")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<OrganizationMember | null>(null)

  const actor = { id: profile?.uid ?? "", name: profile?.displayName || "An admin" }
  const pendingInvitations = useMemo(
    () => invitations.filter((entry) => entry.status === "pending"),
    [invitations],
  )

  const invite = async (): Promise<void> => {
    const problem = validateEmail(email, t("members.thatEmail"))
    if (problem) {
      setEmailError(problem)
      return
    }
    setEmailError(null)
    setBusy(true)
    try {
      const result = await addMemberByEmail(organizationId ?? "", email, inviteRole, actor)
      setEmail("")
      setInviteOpen(false)
      toast.showSuccess(
        result.invited
          ? t("organizations.invited", { email })
          : t("organizations.memberAdded", { name: email }),
      )
    } catch (err) {
      toast.showError(toFriendlyError(err, t("members.couldNotInvite")))
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (member: OrganizationMember, next: OrganizationRole): Promise<void> => {
    if (member.role === next) return
    try {
      await updateMemberRole(organizationId ?? "", member.uid, next, actor)
      toast.showSuccess(
        t("organizations.memberRoleChanged", {
          name: member.displayName,
          role: t(`organizations.${next}`).toLowerCase(),
        }),
      )
    } catch (err) {
      toast.showError(toFriendlyError(err, t("members.couldNotChangeRole")))
    }
  }

  const remove = async (): Promise<void> => {
    if (!pendingRemoval) return
    setBusy(true)
    try {
      await removeMember(organizationId ?? "", pendingRemoval.uid, actor)
      toast.showSuccess(t("organizations.memberRemoved", { name: pendingRemoval.displayName }))
      setPendingRemoval(null)
    } catch (err) {
      toast.showError(toFriendlyError(err, t("members.couldNotRemove")))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (invitationId: string, invitee: string): Promise<void> => {
    try {
      await revokeInvitation(organizationId ?? "", invitationId, actor)
      toast.showSuccess(t("members.invitationRevokedFor", { email: invitee }))
    } catch (err) {
      toast.showError(toFriendlyError(err, t("members.couldNotRevoke")))
    }
  }

  return (
    <ModalScreen
      title={t("organizations.members")}
      subtitle={organization?.name}
      headerRight={
        isAdmin ? (
          <IconButton
            label={t("members.inviteSomeone")}
            variant="secondary"
            onPress={() => setInviteOpen(true)}
            icon={<PlusIcon size={18} color={Theme.colors.text} />}
          />
        ) : null
      }
    >
      {error ? <ErrorState message={error} /> : null}

      {loading ? (
        <SkeletonList count={3} height={72} />
      ) : (
        <View style={styles.list}>
          {members.map((member) => (
            <Card key={member.uid} style={styles.memberRow}>
              <Avatar
                photoURL={member.photoURL}
                name={member.displayName}
                size={40}
                accessibilityLabel={`${member.displayName}${member.email ? `, ${member.email}` : ""}`}
              />

              <View style={styles.flex}>
                <View style={styles.nameRow}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {member.displayName}
                  </AppText>
                  {member.uid === profile?.uid ? <Badge label={t("members.you")} tone="primary" /> : null}
                  {member.uid === organization?.ownerId ? (
                    <Badge label={t("organizations.owner")} tone="accent" />
                  ) : null}
                </View>
                {member.email ? (
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {member.email}
                  </AppText>
                ) : null}
                {member.joinedAt ? (
                  <AppText variant="caption" tone="faint">
                    {t("members.joined", { time: formatRelativeTime(toDate(member.joinedAt)) })}
                  </AppText>
                ) : null}
              </View>

              {isAdmin ? (
                <View style={styles.actions}>
                  <Chip
                    label={t(`organizations.${member.role}`)}
                    tone={member.role === "admin" ? "primary" : "default"}
                    onPress={() => void changeRole(member, member.role === "admin" ? "member" : "admin")}
                    accessibilityLabel={t("members.roleA11y", {
                      name: member.displayName,
                      role: t(`organizations.${member.role}`),
                    })}
                  />
                  {member.uid !== profile?.uid ? (
                    <IconButton
                      label={t("members.removeA11y", { name: member.displayName })}
                      size={32}
                      onPress={() => setPendingRemoval(member)}
                      icon={<TrashIcon size={16} color={Theme.colors.danger} />}
                    />
                  ) : null}
                </View>
              ) : (
                <Badge
                  label={t(`organizations.${member.role}`)}
                  tone={member.role === "admin" ? "primary" : "default"}
                />
              )}
            </Card>
          ))}
        </View>
      )}

      {isAdmin ? (
        <Section
          title={t("members.pendingInvitations")}
          subtitle={
            pendingInvitations.length > 0
              ? t("members.openInvites", { count: pendingInvitations.length })
              : undefined
          }
        >
          {pendingInvitations.length === 0 ? (
            <AppText variant="caption" tone="faint">
              {t("organizations.noInvites")}
            </AppText>
          ) : (
            pendingInvitations.map((invitation) => (
              <Card key={invitation.id} style={styles.inviteRow}>
                <EmailIcon size={16} color={Theme.colors.accent} />
                <View style={styles.flex}>
                  <AppText variant="body" numberOfLines={1}>
                    {invitation.email}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {t("auth.invitedBy", { name: invitation.invitedByName || t("common.unknownAdmin") })} ·{" "}
                    {t(`organizations.${invitation.role}`)}
                  </AppText>
                </View>
                <IconButton
                  label={t("members.revokeA11y", { email: invitation.email })}
                  size={32}
                  onPress={() => void revoke(invitation.id, invitation.email)}
                  icon={<CloseIcon size={16} color={Theme.colors.danger} />}
                />
              </Card>
            ))
          )}
        </Section>
      ) : null}

      <Dialog
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={t("members.inviteSomeone")}
        description={t("organizations.inviteDescription")}
        confirmLabel={t("members.sendInvite")}
        confirmLoading={busy}
        onConfirm={() => void invite()}
      >
        <Input
          label={t("auth.email")}
          required
          value={email}
          onChangeText={setEmail}
          placeholder={t("organizations.emailPlaceholder")}
          keyboardType="email-address"
          autoCapitalize="none"
          error={emailError}
          icon={<EmailIcon size={15} color={Theme.colors.textFaint} />}
        />
        <View style={styles.roleRow}>
          {(["member", "admin"] as OrganizationRole[]).map((entry) => (
            <Chip
              key={entry}
              label={entry === "admin" ? t("members.adminCanEdit") : t("members.memberCanSuggest")}
              tone="primary"
              selected={inviteRole === entry}
              onPress={() => setInviteRole(entry)}
            />
          ))}
        </View>
      </Dialog>

      <Dialog
        visible={pendingRemoval !== null}
        onClose={() => setPendingRemoval(null)}
        title={t("members.removeTitle", { name: pendingRemoval?.displayName ?? t("members.thisMember") })}
        description={t("members.removeDescription", {
          band: organization?.name ?? t("members.thisBand"),
        })}
        confirmLabel={t("organizations.removeMember")}
        tone="danger"
        confirmLoading={busy}
        onConfirm={() => void remove()}
      />

      {!loading && members.length === 0 ? (
        <EmptyState
          icon={<GroupIcon size={24} color={Theme.colors.primary} />}
          title={t("organizations.noMembers")}
          message={isAdmin ? t("members.noMembersAdmin") : t("members.noMembersViewer")}
          actionLabel={isAdmin ? t("members.inviteSomeone") : undefined}
          onAction={isAdmin ? () => setInviteOpen(true) : undefined}
        />
      ) : null}

      {!isAdmin ? (
        <AppText variant="caption" tone="faint">
          {t("organizations.membersCount", { count: members.length })} ·{" "}
          {t("members.yourRole", { role: t(`organizations.${role ?? "member"}`).toLowerCase() })}.
        </AppText>
      ) : (
        <AppText variant="caption" tone="faint">
          <ShieldCheckIcon size={12} color={Theme.colors.textFaint} /> {t("members.adminFooter")}
        </AppText>
      )}
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    list: { gap: Theme.spacing.m },
    memberRow: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    inviteRow: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    flex: { flex: 1, minWidth: 0 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    actions: { flexDirection: "row", alignItems: "center", gap: 4 },
    roleRow: { gap: 6 },
  })
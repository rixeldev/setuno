import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"

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
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { addMemberByEmail, removeMember, revokeInvitation, updateMemberRole } from "@/services/organizations"
import { toFriendlyError } from "@/services/errors"
import { formatRelativeTime, pluralize } from "@/libs/format"
import { toDate } from "@/interfaces/timestamp"
import { validateEmail } from "@/libs/validation"
import { ROLE_LABELS } from "@/interfaces"
import type { OrganizationMember, OrganizationRole } from "@/interfaces"

/**
 * Members and invitations (docs §7, §18): admins invite by email, change roles
 * and remove people; everyone can see who is in the band.
 */
export default function MembersScreen() {
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
    const problem = validateEmail(email, "That email")
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
          ? `${email} can join now — they just need to accept the invitation.`
          : "They were added to the band.",
      )
    } catch (err) {
      toast.showError(toFriendlyError(err, "We couldn't invite that person."))
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (member: OrganizationMember, next: OrganizationRole): Promise<void> => {
    if (member.role === next) return
    try {
      await updateMemberRole(organizationId ?? "", member.uid, next, actor)
      toast.showSuccess(`${member.displayName} is now ${ROLE_LABELS[next].toLowerCase()}.`)
    } catch (err) {
      toast.showError(toFriendlyError(err, "We couldn't change that role."))
    }
  }

  const remove = async (): Promise<void> => {
    if (!pendingRemoval) return
    setBusy(true)
    try {
      await removeMember(organizationId ?? "", pendingRemoval.uid, actor)
      toast.showSuccess(`${pendingRemoval.displayName} was removed from the band.`)
      setPendingRemoval(null)
    } catch (err) {
      toast.showError(toFriendlyError(err, "We couldn't remove that member."))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (invitationId: string, invitee: string): Promise<void> => {
    try {
      await revokeInvitation(organizationId ?? "", invitationId, actor)
      toast.showSuccess(`The invitation for ${invitee} was revoked.`)
    } catch (err) {
      toast.showError(toFriendlyError(err, "We couldn't revoke that invitation."))
    }
  }

  return (
    <ScreenContainer
      title="Members"
      subtitle={organization?.name}
      large
      headerRight={
        isAdmin ? (
          <IconButton
            label="Invite someone"
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
                  {member.uid === profile?.uid ? <Badge label="You" tone="primary" /> : null}
                  {member.uid === organization?.ownerId ? (
                    <Badge label="Owner" tone="accent" />
                  ) : null}
                </View>
                {member.email ? (
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {member.email}
                  </AppText>
                ) : null}
                {member.joinedAt ? (
                  <AppText variant="caption" tone="faint">
                    Joined {formatRelativeTime(toDate(member.joinedAt))}
                  </AppText>
                ) : null}
              </View>

              {isAdmin ? (
                <View style={styles.actions}>
                  <Chip
                    label={ROLE_LABELS[member.role]}
                    tone={member.role === "admin" ? "primary" : "default"}
                    onPress={() => void changeRole(member, member.role === "admin" ? "member" : "admin")}
                    accessibilityLabel={`${member.displayName} is ${ROLE_LABELS[member.role]}. Tap to change the role.`}
                  />
                  {member.uid !== profile?.uid ? (
                    <IconButton
                      label={`Remove ${member.displayName}`}
                      size={32}
                      onPress={() => setPendingRemoval(member)}
                      icon={<TrashIcon size={16} color={Theme.colors.danger} />}
                    />
                  ) : null}
                </View>
              ) : (
                <Badge label={ROLE_LABELS[member.role]} tone={member.role === "admin" ? "primary" : "default"} />
              )}
            </Card>
          ))}
        </View>
      )}

      {isAdmin ? (
        <Section
          title="Pending invitations"
          subtitle={
            pendingInvitations.length > 0
              ? `${pendingInvitations.length} open · they join when the invitation is accepted`
              : undefined
          }
        >
          {pendingInvitations.length === 0 ? (
            <AppText variant="caption" tone="faint">
              No open invitations. Invite someone by email — they join when they accept it.
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
                    Invited by {invitation.invitedByName || "an admin"} ·{" "}
                    {ROLE_LABELS[invitation.role]}
                  </AppText>
                </View>
                <IconButton
                  label={`Revoke the invitation for ${invitation.email}`}
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
        title="Invite someone"
        description="They join with one tap as soon as they sign in with this email address."
        confirmLabel="Send invite"
        confirmLoading={busy}
        onConfirm={() => void invite()}
      >
        <Input
          label="Email"
          required
          value={email}
          onChangeText={setEmail}
          placeholder="player@band.com"
          keyboardType="email-address"
          autoCapitalize="none"
          error={emailError}
          icon={<EmailIcon size={15} color={Theme.colors.textFaint} />}
        />
        <View style={styles.roleRow}>
          {(["member", "admin"] as OrganizationRole[]).map((entry) => (
            <Chip
              key={entry}
              label={entry === "admin" ? "Admin — can edit everything" : "Member — can suggest changes"}
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
        title={`Remove ${pendingRemoval?.displayName ?? "this member"}?`}
        description={`They lose access to ${organization?.name ?? "this band"} straight away. Their suggestions stay in the history.`}
        confirmLabel="Remove member"
        tone="danger"
        confirmLoading={busy}
        onConfirm={() => void remove()}
      />

      {!loading && members.length === 0 ? (
        <EmptyState
          icon={<GroupIcon size={24} color={Theme.colors.primary} />}
          title="No members yet"
          message={
            isAdmin
              ? "Invite the rest of the band by email."
              : "Only admins can see this list."
          }
          actionLabel={isAdmin ? "Invite someone" : undefined}
          onAction={isAdmin ? () => setInviteOpen(true) : undefined}
        />
      ) : null}

      {!isAdmin ? (
        <AppText variant="caption" tone="faint">
          {pluralize(members.length, "member")} · your role is {ROLE_LABELS[role ?? "member"].toLowerCase()}.
        </AppText>
      ) : (
        <AppText variant="caption" tone="faint">
          <ShieldCheckIcon size={12} color={Theme.colors.textFaint} /> You are an admin: you can edit songs,
          setlists, shows and members.
        </AppText>
      )}
    </ScreenContainer>
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
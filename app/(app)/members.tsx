import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Avatar } from "@/components/ui/Avatar"
import { Badge, Card, Chip } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import { DotsIcon, EmailIcon, GroupIcon, PlusIcon } from "@/components/ui/Icons"
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
 * Members and invitations (docs §7, §18): one tidy surface per group. Role and
 * removal actions live behind a per-member options sheet, so nothing dangerous
 * happens from a stray tap and the rows stay readable on every platform.
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
  const [menuMember, setMenuMember] = useState<OrganizationMember | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<OrganizationMember | null>(null)

  const actor = { id: profile?.uid ?? "", name: profile?.displayName || "An admin" }
  const pendingInvitations = useMemo(
    () => invitations.filter((entry) => entry.status === "pending"),
    [invitations],
  )

  /** Only admins manage people, and never themselves nor the band owner. */
  const canManage = (member: OrganizationMember): boolean =>
    isAdmin && member.uid !== profile?.uid && member.uid !== organization?.ownerId

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
      ) : members.length === 0 ? (
        <EmptyState
          icon={<GroupIcon size={24} color={Theme.colors.primary} />}
          title={t("organizations.noMembers")}
          message={isAdmin ? t("members.noMembersAdmin") : t("members.noMembersViewer")}
          actionLabel={isAdmin ? t("members.inviteSomeone") : undefined}
          onAction={isAdmin ? () => setInviteOpen(true) : undefined}
        />
      ) : (
        <View style={styles.block}>
          <AppText variant="label" tone="faint">
            {t("organizations.membersCount", { count: members.length })}
          </AppText>
          <Card padded={false} style={styles.surface}>
            {members.map((member, index) => (
              <View key={member.uid} style={[styles.row, index > 0 && styles.divider]}>
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
                    {member.uid === profile?.uid ? (
                      <Badge label={t("members.you")} tone="primary" />
                    ) : null}
                  </View>
                  <AppText
                    variant="caption"
                    tone={
                      member.uid === organization?.ownerId
                        ? "accent"
                        : member.role === "admin"
                          ? "primary"
                          : "muted"
                    }
                    numberOfLines={1}
                  >
                    {member.uid === organization?.ownerId
                      ? t("organizations.owner")
                      : member.role === "admin"
                        ? t("organizations.admin")
                        : t("organizations.member")}
                  </AppText>
                  {member.email || member.joinedAt ? (
                    <AppText variant="caption" tone="faint" numberOfLines={1}>
                      {[
                        member.email,
                        member.joinedAt
                          ? t("members.joined", { time: formatRelativeTime(toDate(member.joinedAt)) })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </AppText>
                  ) : null}
                </View>

                {canManage(member) ? (
                  <IconButton
                    label={t("members.actions", { name: member.displayName })}
                    size={32}
                    onPress={() => setMenuMember(member)}
                    icon={<DotsIcon size={16} color={Theme.colors.textMuted} />}
                  />
                ) : null}
              </View>
            ))}
          </Card>
        </View>
      )}

      {isAdmin && pendingInvitations.length > 0 ? (
        <View style={styles.block}>
          <AppText variant="label" tone="faint">
            {t("members.pendingInvitations")}
          </AppText>
          <Card padded={false} style={styles.surface}>
            {pendingInvitations.map((invitation, index) => (
              <View key={invitation.id} style={[styles.row, index > 0 && styles.divider]}>
                <EmailIcon size={16} color={Theme.colors.accent} />
                <View style={styles.flex}>
                  <AppText variant="body" numberOfLines={1}>
                    {invitation.email}
                  </AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {t("auth.invitedBy", {
                      name: invitation.invitedByName || t("common.unknownAdmin"),
                    })}{" "}
                    · {t(`organizations.${invitation.role}`)}
                  </AppText>
                </View>
                <Button
                  label={t("members.revoke")}
                  size="sm"
                  variant="ghost"
                  accessibilityHint={t("members.revokeA11y", { email: invitation.email })}
                  onPress={() => void revoke(invitation.id, invitation.email)}
                />
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <AppText variant="caption" tone="faint">
        {isAdmin
          ? t("members.adminFooter")
          : t("members.yourRole", { role: t(`organizations.${role ?? "member"}`).toLowerCase() })}
      </AppText>

      <BottomSheet
        visible={menuMember !== null}
        onClose={() => setMenuMember(null)}
        title={menuMember?.displayName ?? ""}
        subtitle={menuMember ? t(`organizations.${menuMember.role}`) : undefined}
      >
        {menuMember ? (
          <>
            <SheetOptionRow
              label={
                menuMember.role === "admin" ? t("members.makeMember") : t("members.makeAdmin")
              }
              onPress={() => {
                const member = menuMember
                setMenuMember(null)
                void changeRole(member, member.role === "admin" ? "member" : "admin")
              }}
            />
            <SheetOptionRow
              label={t("organizations.removeMember")}
              onPress={() => {
                setPendingRemoval(menuMember)
                setMenuMember(null)
              }}
            />
          </>
        ) : null}
      </BottomSheet>

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
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    block: { gap: Theme.spacing.s },
    surface: { overflow: "hidden" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingHorizontal: Theme.spacing.l,
      paddingVertical: Theme.spacing.m,
    },
    divider: { borderTopWidth: 1, borderTopColor: Theme.colors.borderSoft },
    flex: { flex: 1, minWidth: 0, gap: 2 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    roleRow: { gap: 6 },
  })

import React, { useState } from "react"
import { Platform, Share, StyleSheet, View } from "react-native"
import * as Clipboard from "expo-clipboard"
import { useTranslation } from "react-i18next"
import QRCode from "react-native-qrcode-svg"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import { Button } from "@/components/ui/Button"
import { Badge, Chip } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { CopyIcon, RefreshIcon, ShareIcon } from "@/components/ui/Icons"
import { useToast } from "@/components/ui/Toast"
import { formatDate } from "@/libs/format"
import {
  INVITE_ROLE_LABEL_KEYS,
  INVITE_ROLES,
  buildInviteUrl,
  inviteExpiryKey,
} from "@/libs/inviteLink"
import { resolveShareBaseUrl } from "@/libs/shareLink"
import { toFriendlyError } from "@/services/errors"
import {
  createInviteLink,
  revokeInviteLink,
  type InviteLinkInfo,
} from "@/services/inviteLinks"
import {
  DEFAULT_INVITE_LINK_EXPIRY_DAYS,
  INVITE_LINK_EXPIRY_DAYS,
  type InviteRole,
} from "@/functions/src/inviteLinks"

export interface InviteLinkSheetProps {
  visible: boolean
  onClose: () => void
  organizationId: string
  /** The band's name, shown under the sheet's heading. */
  organizationName: string
}

type Phase = "form" | "creating" | "ready" | "failed"

/**
 * The one place an invitation link is minted, shown and killed (roadmap #89):
 * pick the role it grants and how long it lives, create, then scan/copy/share
 * the QR + URL. The email invitation stays available next door — this sheet is
 * for the people whose address nobody wants to ask for.
 *
 * Creation is idempotent per band, so opening it twice hands out the same URL
 * rather than a second one; "Change settings" reopens the form and rewrites the
 * same link in place, while "Generate a new link" rotates the token on purpose
 * (a link forwarded one chat too far cannot be un-forwarded). Closing always
 * resets: state and `visible` are never synced from an effect.
 */
export function InviteLinkSheet({
  visible,
  onClose,
  organizationId,
  organizationName,
}: InviteLinkSheetProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const styles = useThemedStyles(createSheetStyles)

  const [role, setRole] = useState<InviteRole>("member")
  const [days, setDays] = useState<number | null>(DEFAULT_INVITE_LINK_EXPIRY_DAYS)
  const [phase, setPhase] = useState<Phase>("form")
  const [link, setLink] = useState<InviteLinkInfo | null>(null)
  const [message, setMessage] = useState("")
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [rotating, setRotating] = useState(false)

  const baseUrl = resolveShareBaseUrl()
  const url = link && baseUrl ? buildInviteUrl(baseUrl, link.token) : null

  const create = async (): Promise<void> => {
    if (!baseUrl) {
      setMessage(t("inviteLink.notConfigured"))
      setPhase("failed")
      return
    }
    if (!organizationId) {
      setMessage(t("inviteLink.createFailed"))
      setPhase("failed")
      return
    }
    setMessage("")
    setPhase("creating")
    try {
      const next = await createInviteLink({ organizationId, role, expiresInDays: days })
      setLink(next)
      setPhase("ready")
    } catch (error) {
      setMessage(toFriendlyError(error, t("inviteLink.createFailed")))
      setPhase("failed")
    }
  }

  const copy = async (): Promise<void> => {
    if (!url) return
    await Clipboard.setStringAsync(url)
    toast.showSuccess(t("common.copied"))
  }

  const openSystemShare = async (): Promise<void> => {
    if (!url) return
    if (Platform.OS === "web") {
      // Web Share API where the browser has it (phones, Safari); elsewhere the
      // link goes to the clipboard, which is what a desktop user wants anyway.
      const page = globalThis as unknown as {
        navigator?: { share?: (data: { url: string; title?: string }) => Promise<void> }
      }
      if (page.navigator?.share) {
        try {
          await page.navigator.share({ url, title: organizationName })
        } catch {
          // Dismissed by the user — not an error.
        }
        return
      }
      await copy()
      return
    }
    try {
      await Share.share({ message: url, title: organizationName })
    } catch {
      // Cancelled share sheet — nothing to do.
    }
  }

  const revoke = async (): Promise<void> => {
    if (!link) return
    setRevoking(true)
    try {
      await revokeInviteLink(link.token)
      setConfirmRevoke(false)
      setLink(null)
      setPhase("form")
      toast.showSuccess(t("inviteLink.revoked"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("inviteLink.revokeFailed")))
    } finally {
      setRevoking(false)
    }
  }

  /**
   * Replace the token with a fresh one, keeping the role and the expiry the
   * sheet is already showing. The old URL dies server-side, so a link that went
   * to the wrong chat stops working the moment this succeeds.
   */
  const rotate = async (): Promise<void> => {
    if (!link || !baseUrl) return
    setRotating(true)
    try {
      const next = await createInviteLink({
        organizationId,
        role: link.role,
        expiresInDays: days,
        rotate: true,
      })
      setLink(next)
      setConfirmRotate(false)
      toast.showSuccess(t("inviteLink.rotated"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("inviteLink.createFailed")))
    } finally {
      setRotating(false)
    }
  }

  const close = (): void => {
    setPhase("form")
    setLink(null)
    setMessage("")
    setRole("member")
    setDays(DEFAULT_INVITE_LINK_EXPIRY_DAYS)
    setConfirmRevoke(false)
    setConfirmRotate(false)
    onClose()
  }

  const expiryCaption = (expiresAt: number | null): string =>
    expiresAt === null
      ? t("inviteLink.expiresNever")
      : t("inviteLink.expiresOn", { date: formatDate(new Date(expiresAt)) })

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={close}
        title={t("inviteLink.title")}
        subtitle={organizationName}
      >
        {phase === "ready" && url && link ? (
          <View style={styles.ready}>
            <View
              style={styles.qrCard}
              accessible
              accessibilityRole="image"
              accessibilityLabel={url}
            >
              {/* Always dark-on-light: a scanner must not depend on the theme. */}
              <QRCode value={url} size={176} color="#000000" backgroundColor="#FFFFFF" ecl="M" />
            </View>
            <AppText variant="caption" tone="muted" selectable style={styles.url}>
              {url}
            </AppText>
            <View style={styles.meta}>
              <Badge label={t(INVITE_ROLE_LABEL_KEYS[link.role])} tone="primary" />
              <AppText variant="caption" tone="faint">
                {expiryCaption(link.expiresAt)}
              </AppText>
              <AppText variant="caption" tone="faint">
                {t("inviteLink.uses", { count: link.uses })}
              </AppText>
            </View>
            <View style={styles.actions}>
              <Button
                label={t("common.copy")}
                variant="secondary"
                icon={<CopyIcon size={16} color={Theme.colors.textMuted} />}
                onPress={() => void copy()}
                style={styles.action}
              />
              <Button
                label={t("common.share")}
                icon={<ShareIcon size={16} color={Theme.colors.onPrimary} />}
                onPress={() => void openSystemShare()}
                style={styles.action}
              />
            </View>
            <Button
              label={t("inviteLink.rotate")}
              variant="ghost"
              icon={<RefreshIcon size={16} color={Theme.colors.textMuted} />}
              onPress={() => setConfirmRotate(true)}
            />
            <Button
              label={t("inviteLink.edit")}
              variant="ghost"
              onPress={() => {
                setMessage("")
                setPhase("form")
              }}
            />
            <Button
              label={t("inviteLink.revoke")}
              variant="danger"
              onPress={() => setConfirmRevoke(true)}
            />
          </View>
        ) : (
          <View style={styles.form}>
            <AppText variant="caption" tone="muted">
              {t("inviteLink.explain")}
            </AppText>
            <View style={styles.group}>
              <AppText variant="caption" tone="faint">
                {t("inviteLink.role")}
              </AppText>
              <View style={styles.chips}>
                {INVITE_ROLES.map((entry) => (
                  <Chip
                    key={entry}
                    label={t(INVITE_ROLE_LABEL_KEYS[entry])}
                    tone="primary"
                    selected={role === entry}
                    onPress={() => setRole(entry)}
                  />
                ))}
              </View>
            </View>
            <View style={styles.group}>
              <AppText variant="caption" tone="faint">
                {t("inviteLink.expiry")}
              </AppText>
              {INVITE_LINK_EXPIRY_DAYS.map((option) => (
                <SheetOptionRow
                  key={option === null ? "never" : `${option}d`}
                  label={t(inviteExpiryKey(option))}
                  selected={days === option}
                  onPress={() => setDays(option)}
                />
              ))}
            </View>
            {phase === "failed" && message ? (
              <AppText variant="caption" tone="danger">
                {message}
              </AppText>
            ) : null}
            <Button
              label={phase === "failed" ? t("common.tryAgain") : t("inviteLink.create")}
              loading={phase === "creating"}
              onPress={() => void create()}
            />
          </View>
        )}
      </BottomSheet>

      <Dialog
        visible={confirmRevoke}
        onClose={() => setConfirmRevoke(false)}
        title={t("inviteLink.revokeTitle")}
        description={t("inviteLink.revokeDescription", { band: organizationName })}
        confirmLabel={t("inviteLink.revoke")}
        tone="danger"
        confirmLoading={revoking}
        onConfirm={() => void revoke()}
      />

      <Dialog
        visible={confirmRotate}
        onClose={() => setConfirmRotate(false)}
        title={t("inviteLink.rotateTitle")}
        description={t("inviteLink.rotateDescription")}
        confirmLabel={t("inviteLink.rotate")}
        tone="danger"
        confirmLoading={rotating}
        onConfirm={() => void rotate()}
      />
    </>
  )
}

const createSheetStyles = () =>
  StyleSheet.create({
    form: { gap: Theme.spacing.m },
    group: { gap: Theme.spacing.s },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    ready: { gap: Theme.spacing.m, alignItems: "center" },
    qrCard: {
      backgroundColor: "#FFFFFF",
      padding: Theme.spacing.m,
      borderRadius: Theme.radii.lg,
      alignItems: "center",
    },
    url: { textAlign: "center" },
    meta: { gap: 4, alignItems: "center" },
    actions: { flexDirection: "row", gap: Theme.spacing.s, alignSelf: "stretch" },
    action: { flex: 1, minWidth: 0 },
  })

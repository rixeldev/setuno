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
import { Dialog } from "@/components/ui/Dialog"
import { CopyIcon, ShareIcon } from "@/components/ui/Icons"
import { useToast } from "@/components/ui/Toast"
import { formatDate } from "@/libs/format"
import { buildShareUrl, resolveShareBaseUrl } from "@/libs/shareLink"
import { toFriendlyError } from "@/services/errors"
import { createShareLink, revokeShareLink, type ShareLink } from "@/services/shares"
import { SHARE_EXPIRY_DAYS, type ShareKind } from "@/functions/src/shares"

export interface ShareSheetProps {
  visible: boolean
  onClose: () => void
  /** What this link publishes: one song or one setlist. */
  kind: ShareKind
  organizationId: string
  sourceId: string
  /** Song title or setlist name — shown under the sheet's heading. */
  title: string
}

type Phase = "form" | "creating" | "ready" | "failed"

/**
 * The one place a share link is minted, shown and killed (roadmap #56): pick
 * an expiry, create, scan/copy the QR + URL, revoke behind a danger dialog.
 *
 * The link only appears here — no share list exists anywhere — and creation is
 * idempotent per source, so opening the sheet twice hands out the same URL
 * rather than a second one. Closing always resets: the sheet opens fresh on
 * the next call, because state and visible are never synced from an effect.
 */
export function ShareSheet({
  visible,
  onClose,
  kind,
  organizationId,
  sourceId,
  title,
}: ShareSheetProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const styles = useThemedStyles(createSheetStyles)

  const [days, setDays] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>("form")
  const [link, setLink] = useState<ShareLink | null>(null)
  const [message, setMessage] = useState("")
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [revoking, setRevoking] = useState(false)

  const baseUrl = resolveShareBaseUrl()
  const url = link && baseUrl ? buildShareUrl(baseUrl, link.token) : null

  const create = async () => {
    if (!baseUrl) {
      setMessage(t("shares.notConfigured"))
      setPhase("failed")
      return
    }
    setMessage("")
    setPhase("creating")
    try {
      const next = await createShareLink({
        kind,
        organizationId,
        sourceId,
        expiresInDays: days,
      })
      setLink(next)
      setPhase("ready")
    } catch (error) {
      setMessage(toFriendlyError(error, t("shares.createFailed")))
      setPhase("failed")
    }
  }

  const copy = async () => {
    if (!url) return
    await Clipboard.setStringAsync(url)
    toast.showSuccess(t("common.copied"))
  }

  const openSystemShare = async () => {
    if (!url) return
    if (Platform.OS === "web") {
      // Web Share API where the browser has it (phones, Safari); elsewhere the
      // link goes to the clipboard, which is what a desktop user wants anyway.
      const page = globalThis as unknown as {
        navigator?: { share?: (data: { url: string; title?: string }) => Promise<void> }
      }
      if (page.navigator?.share) {
        try {
          await page.navigator.share({ url, title })
        } catch {
          // Dismissed by the user — not an error.
        }
        return
      }
      await copy()
      return
    }
    try {
      await Share.share({ message: url, title })
    } catch {
      // Cancelled share sheet — nothing to do.
    }
  }

  const revoke = async () => {
    if (!link) return
    setRevoking(true)
    try {
      await revokeShareLink(link.token)
      setConfirmRevoke(false)
      setLink(null)
      setPhase("form")
      toast.showSuccess(t("shares.revoked"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("shares.revokeFailed")))
    } finally {
      setRevoking(false)
    }
  }

  const close = () => {
    setPhase("form")
    setLink(null)
    setMessage("")
    setDays(null)
    setConfirmRevoke(false)
    onClose()
  }

  return (
    <>
      <BottomSheet visible={visible} onClose={close} title={t("shares.title")} subtitle={title}>
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
            <AppText variant="caption" tone="faint">
              {link.expiresAt
                ? t("shares.expiresOn", { date: formatDate(new Date(link.expiresAt)) })
                : t("shares.expiresNever")}
            </AppText>
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
            <Button label={t("shares.revoke")} variant="danger" onPress={() => setConfirmRevoke(true)} />
          </View>
        ) : (
          <View style={styles.form}>
            <AppText variant="caption" tone="muted">
              {t("shares.explain")}
            </AppText>
            <View style={styles.expiry}>
              <AppText variant="caption" tone="faint">
                {t("shares.expiry")}
              </AppText>
              {SHARE_EXPIRY_DAYS.map((option) => (
                <SheetOptionRow
                  key={option === null ? "never" : `${option}d`}
                  label={
                    option === null ? t("shares.expiryNever") : t("shares.expiryDays", { count: option })
                  }
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
              label={phase === "failed" ? t("common.tryAgain") : t("shares.createLink")}
              loading={phase === "creating"}
              onPress={() => void create()}
            />
          </View>
        )}
      </BottomSheet>

      <Dialog
        visible={confirmRevoke}
        onClose={() => setConfirmRevoke(false)}
        title={t("shares.revokeTitle")}
        description={t("shares.revokeDescription")}
        confirmLabel={t("shares.revoke")}
        tone="danger"
        confirmLoading={revoking}
        onConfirm={() => void revoke()}
      />
    </>
  )
}

const createSheetStyles = () =>
  StyleSheet.create({
    form: { gap: Theme.spacing.m },
    expiry: { gap: Theme.spacing.s },
    ready: { gap: Theme.spacing.m, alignItems: "center" },
    qrCard: {
      backgroundColor: "#FFFFFF",
      padding: Theme.spacing.m,
      borderRadius: Theme.radii.lg,
      alignItems: "center",
    },
    url: { textAlign: "center" },
    actions: { flexDirection: "row", gap: Theme.spacing.s, alignSelf: "stretch" },
    action: { flex: 1, minWidth: 0 },
  })

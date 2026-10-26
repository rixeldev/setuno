import React, { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { ErrorState } from "@/components/ui/States"
import { UsersIcon } from "@/components/ui/Icons"
import { AuthLayout } from "@/components/app/AuthLayout"
import { useToast } from "@/components/ui/Toast"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { formatDate } from "@/libs/format"
import { INVITE_ROLE_LABEL_KEYS, isInviteLinkGone } from "@/libs/inviteLink"
import { toFriendlyError } from "@/services/errors"
import { previewInviteLink, redeemInviteLink, type InvitePreview } from "@/services/inviteLinks"
import { savePendingJoin } from "@/services/pendingJoin"

type Phase = "loading" | "ready" | "gone" | "failed"

/**
 * The invitation link itself (roadmap #89): a public page, deliberately outside
 * the `(auth)` and `(app)` groups so a visitor with no account lands here
 * without bouncing through sign-in first.
 *
 * It reads the link through the `previewInviteLink` callable — the band's name,
 * the role it grants, its deadline and who sent it — and then either joins the
 * caller in one tap (signed in) or parks the token and sends them to sign in
 * (`services/pendingJoin`), where `hooks/usePendingJoin` finishes the job. A
 * revoked, expired or invented link degrades to one honest "no longer valid"
 * state: the page never shows a band that is not there.
 */
export default function JoinScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>()
  const tokenValue = Array.isArray(params.token) ? params.token[0] : params.token
  const token = typeof tokenValue === "string" ? tokenValue : ""

  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const styles = useThemedStyles(createStyles)
  const { user } = useAuth()
  const { switchOrganization } = useOrganization()

  const [phase, setPhase] = useState<Phase>("loading")
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)

  // The preview is public, but the answer changes once there is an account
  // (`alreadyMember`), so it is re-read when the session lands.
  const uid = user?.uid ?? null
  useEffect(() => {
    if (!token) return
    let cancelled = false
    previewInviteLink(token)
      .then((result) => {
        if (cancelled) return
        setPreview(result)
        setPhase(result.state === "ready" ? "ready" : "gone")
      })
      .catch(() => {
        if (!cancelled) setPhase("failed")
      })
    return () => {
      cancelled = true
    }
  }, [token, attempt, uid])

  const retry = (): void => {
    setPhase("loading")
    setAttempt((value) => value + 1)
  }

  /**
   * One tap: join now when there is an account, or remember the link and ask
   * for one when there is not. Both halves end in the same place, so the copy
   * only has to say "join" and the page decides how.
   */
  const join = async (): Promise<void> => {
    if (!preview || preview.state !== "ready") return
    if (!user) {
      await savePendingJoin(token)
      router.push("/(auth)/sign-in")
      return
    }
    setBusy(true)
    try {
      const result = await redeemInviteLink(token)
      await switchOrganization(result.organizationId)
      toast.showSuccess(
        result.alreadyMember
          ? t("join.alreadyMemberToast", { band: result.organizationName })
          : t("join.joinedToast", { band: result.organizationName }),
      )
      router.replace("/(app)")
    } catch (error) {
      if (isInviteLinkGone(error)) setPhase("gone")
      else toast.showError(toFriendlyError(error, t("join.failedMessage")))
    } finally {
      setBusy(false)
    }
  }

  const displayPhase: Phase = token ? phase : "gone"

  if (displayPhase === "loading") {
    return (
      <AuthLayout title={t("join.title")}>
        <View style={styles.centered}>
          <ActivityIndicator color={Theme.colors.primary} />
          <AppText variant="caption" tone="muted">
            {t("common.loading")}
          </AppText>
        </View>
      </AuthLayout>
    )
  }

  if (displayPhase === "gone") {
    return (
      <AuthLayout title={t("join.goneTitle")} subtitle={t("join.goneMessage")}>
        <Button
          label={t("join.openApp")}
          full
          size="lg"
          onPress={() => router.replace("/")}
        />
      </AuthLayout>
    )
  }

  if (displayPhase === "failed") {
    return (
      <AuthLayout title={t("join.title")}>
        <ErrorState
          title={t("join.failedTitle")}
          message={t("join.failedMessage")}
          onRetry={retry}
        />
      </AuthLayout>
    )
  }

  if (!preview) return null

  const roleLabel = t(INVITE_ROLE_LABEL_KEYS[preview.role])
  const expiresCaption =
    preview.expiresAt === null
      ? t("inviteLink.expiresNever")
      : t("inviteLink.expiresOn", { date: formatDate(new Date(preview.expiresAt)) })

  return (
    <AuthLayout
      title={t("join.title")}
      subtitle={t("join.subtitle", { band: preview.organizationName })}
    >
      <Card style={styles.card}>
        <UsersIcon size={28} color={Theme.colors.primary} />
        <AppText variant="heading">{preview.organizationName}</AppText>
        {preview.createdByName ? (
          <AppText variant="caption" tone="muted">
            {t("join.invitedBy", { name: preview.createdByName })}
          </AppText>
        ) : null}
        <Badge label={roleLabel} tone="primary" />
        <View style={styles.meta}>
          <AppText variant="caption" tone="faint">
            {expiresCaption}
          </AppText>
          {preview.uses > 0 ? (
            <AppText variant="caption" tone="faint">
              {t("join.usesCaption", { count: preview.uses })}
            </AppText>
          ) : null}
        </View>
      </Card>

      <AppText variant="caption" tone="muted" style={styles.explain}>
        {preview.alreadyMember ? t("join.alreadyMemberMessage") : t("join.explain")}
      </AppText>

      <Button
        label={
          preview.alreadyMember
            ? t("join.openBand", { band: preview.organizationName })
            : user
              ? t("join.joinButton", { band: preview.organizationName })
              : t("join.signInToJoin")
        }
        full
        size="lg"
        loading={busy}
        onPress={() => void join()}
      />

      {user ? null : (
        <Button
          label={t("join.createAccount")}
          variant="ghost"
          full
          onPress={() => {
            void savePendingJoin(token).then(() => router.push("/(auth)/sign-up"))
          }}
        />
      )}
    </AuthLayout>
  )
}

const createStyles = () =>
  StyleSheet.create({
    centered: { alignItems: "center", gap: Theme.spacing.m, paddingVertical: Theme.spacing.xl },
    card: { gap: Theme.spacing.s },
    meta: { gap: 2, marginTop: Theme.spacing.xs },
    explain: { textAlign: "center" },
  })

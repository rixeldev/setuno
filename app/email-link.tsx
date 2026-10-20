import React, { useEffect, useState } from "react"
import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import { useLinkingURL } from "expo-linking"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { ActivityIndicator } from "react-native"

import { AuthLayout } from "@/components/app/AuthLayout"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { CheckCircleIcon, MailIcon } from "@/components/ui/Icons"
import { Theme } from "@/constants/Theme"
import { useAuth } from "@/hooks/useAuth"
import { validateEmail } from "@/libs/validation"
import { noteEmailLinkReauth } from "@/services/accountData"
import {
  clearPendingEmailLink,
  isEmailLinkSpent,
  isEmailSignInLink,
  readPendingEmailLink,
  redeemEmailSignInLink,
  sendEmailSignInLink,
} from "@/services/emailAuth"
import { toFriendlyError } from "@/services/errors"

/**
 * Email-link sign-in (roadmap #67) — request **and** finish, one route.
 *
 * It deliberately lives at the root of the tree rather than inside `(auth)`,
 * because half its traffic arrives from a member who is *already signed in*:
 * an emailed link is also the re-authentication the account-deletion dialog
 * asks for (a passwordless account has no password to type). The `(auth)`
 * group bounces signed-in users straight back to the app, so a route in there
 * could never serve that half of the flow.
 *
 * - **Request**: the sign-in screen's "email me a link" lands here to send it.
 * - **Finish**: a click opens this route with the one-time code — through
 *   `+native-intent` on a phone, or as the continue URL in a browser — and the
 *   code is redeemed right here.
 */
type Phase = "form" | "sent" | "working" | "ask" | "signin" | "reauth"

export default function EmailLink() {
  const router = useRouter()
  const { t } = useTranslation()
  const { status } = useAuth()
  const params = useLocalSearchParams<{ email?: string }>()
  // The URL that arrived: `window.location.href` on the web (Firebase's
  // handler redirects here with the code appended), the deep link on native.
  const linkUrl = useLinkingURL()
  const arrival = linkUrl ?? ""

  const [phase, setPhase] = useState<Phase>(() =>
    arrival.length > 0 && isEmailSignInLink(arrival) && !isEmailLinkSpent(arrival)
      ? "working"
      : "form",
  )
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({
    defaultValues: { email: typeof params.email === "string" ? params.email : "" },
  })

  // Redeems an arriving link exactly once. Every `set*` below sits behind an
  // `await`, so the effect body itself never sets state synchronously; and the
  // redemption itself is memoized per link (see `redeemEmailSignInLink`),
  // which is what makes StrictMode's double effect — and the native launch
  // URL that keeps being reported — harmless.
  useEffect(() => {
    if (arrival.length === 0 || !isEmailSignInLink(arrival)) return
    if (isEmailLinkSpent(arrival)) return
    let active = true
    void (async () => {
      try {
        const email = await readPendingEmailLink()
        if (!active) return
        // Opened somewhere that never asked for it: make the member say which
        // address the mail went to rather than guessing (and never telling a
        // stranger whether an account exists).
        if (!email) {
          setPhase("ask")
          return
        }
        const outcome = await redeemEmailSignInLink(arrival, email)
        if (!active) return
        await clearPendingEmailLink()
        if (outcome === "reauth") noteEmailLinkReauth()
        setPhase(outcome)
      } catch (error) {
        if (!active) return
        setFormError(toFriendlyError(error, t("auth.couldNotCompleteEmailLink")))
        setPhase("form")
      }
    })()
    return () => {
      active = false
    }
  }, [arrival, t])

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    if (phase === "ask") {
      if (arrival.length === 0) return
      try {
        const outcome = await redeemEmailSignInLink(arrival, values.email)
        await clearPendingEmailLink()
        if (outcome === "reauth") noteEmailLinkReauth()
        setPhase(outcome)
      } catch (error) {
        setFormError(toFriendlyError(error, t("auth.couldNotCompleteEmailLink")))
      }
      return
    }
    try {
      await sendEmailSignInLink(values.email)
      setPhase("sent")
    } catch (error) {
      setFormError(toFriendlyError(error, t("auth.couldNotSendEmailLink")))
    }
  })

  // Navigation stays declarative: neither redirect happens inside an effect.
  if (phase === "reauth") return <Redirect href="/settings/profile" />
  if (phase === "signin" && status === "signed-in") return <Redirect href="/" />

  if (phase === "working" || (phase === "signin" && status !== "signed-out")) {
    return (
      <AuthLayout back title={t("auth.emailLinkTitle")} subtitle={t("auth.emailLinkWorking")}>
        <ActivityIndicator color={Theme.colors.primary} />
      </AuthLayout>
    )
  }

  if (phase === "sent") {
    return (
      <AuthLayout back title={t("auth.emailLinkSentTitle")} subtitle={t("auth.emailLinkSentSubtitle")}>
        <Card style={{ gap: Theme.spacing.m }}>
          <CheckCircleIcon size={28} color={Theme.colors.success} />
          <AppText variant="body">{t("auth.emailLinkSentTo", { email: getValues("email") })}</AppText>
          <AppText variant="caption" tone="muted">
            {t("auth.emailLinkHint")}
          </AppText>
        </Card>
        <Button
          label={t("auth.backToSignIn")}
          variant="secondary"
          full
          onPress={() => router.replace("/(auth)/sign-in")}
        />
      </AuthLayout>
    )
  }

  const asking = phase === "ask"

  return (
    <AuthLayout
      back
      title={asking ? t("auth.emailLinkConfirmTitle") : t("auth.emailLinkTitle")}
      subtitle={asking ? t("auth.emailLinkConfirmSubtitle") : t("auth.emailLinkSubtitle")}
      footer={
        <AppText variant="body" tone="muted">
          {t("auth.rememberedIt")}{" "}
          <AppText
            variant="body"
            tone="primary"
            style={{ fontWeight: "700" }}
            onPress={() => router.replace("/(auth)/sign-in")}
          >
            {t("auth.signIn")}
          </AppText>
        </AppText>
      }
    >
      <Input
        label={t("auth.email")}
        required
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="you@band.com"
        icon={<MailIcon size={16} color={Theme.colors.textFaint} />}
        error={errors.email?.message}
        onSubmitEditing={() => void onSubmit()}
        {...register("email", { validate: (value) => validateEmail(value, t("auth.email")) ?? true })}
      />

      {formError ? (
        <AppText variant="caption" tone="danger" accessibilityRole="alert">
          {formError}
        </AppText>
      ) : null}

      <Button
        label={asking ? t("auth.emailLinkConfirmButton") : t("auth.sendEmailLink")}
        full
        size="lg"
        loading={isSubmitting}
        onPress={() => void onSubmit()}
      />
    </AuthLayout>
  )
}

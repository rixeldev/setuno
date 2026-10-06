import React, { useState } from "react"
import { useRouter } from "expo-router"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { AppText } from "@/components/ui/AppText"
import { Card } from "@/components/ui/Card"
import { AuthLayout } from "@/components/app/AuthLayout"
import { CheckCircleIcon, MailIcon } from "@/components/ui/Icons"
import { Theme } from "@/constants/Theme"
import { useAuth } from "@/hooks/useAuth"
import { toFriendlyError } from "@/services/errors"
import { validateEmail } from "@/libs/validation"

/** Password reset request (docs §5). Never reveals whether an account exists. */
export default function ForgotPassword() {
  const router = useRouter()
  const { t } = useTranslation()
  const { sendPasswordReset } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({ defaultValues: { email: "" } })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await sendPasswordReset(values.email)
      setSent(true)
    } catch (error) {
      setFormError(toFriendlyError(error, t("auth.couldNotSendReset")))
    }
  })

  if (sent) {
    return (
      <AuthLayout back title={t("auth.checkInbox")} subtitle={t("auth.checkInboxSubtitle")}>
        <Card style={{ gap: Theme.spacing.m }}>
          <CheckCircleIcon size={28} color={Theme.colors.success} />
          <AppText variant="body">{t("auth.resetSentTo", { email: getValues("email") })}</AppText>
          <AppText variant="caption" tone="muted">
            {t("auth.resetHint")}
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

  return (
    <AuthLayout
      back
      title={t("auth.resetTitle")}
      subtitle={t("auth.resetSubtitle")}
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
        label={t("auth.sendResetLink")}
        full
        size="lg"
        loading={isSubmitting}
        onPress={() => void onSubmit()}
      />
    </AuthLayout>
  )
}
import React, { useState } from "react"
import { useRouter } from "expo-router"
import { useForm } from "react-hook-form"

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
      setFormError(toFriendlyError(error, "We couldn't send the reset email. Please try again."))
    }
  })

  if (sent) {
    return (
      <AuthLayout title="Check your inbox" subtitle="If that address has a Stage Book account, a reset link is on its way.">
        <Card style={{ gap: Theme.spacing.m }}>
          <CheckCircleIcon size={28} color={Theme.colors.success} />
          <AppText variant="body">We sent a password reset link to {getValues("email")}.</AppText>
          <AppText variant="caption" tone="muted">
            The link expires in an hour. If it doesn’t arrive, check your spam folder or try again.
          </AppText>
        </Card>
        <Button label="Back to sign in" variant="secondary" full onPress={() => router.replace("/(auth)/sign-in")} />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <AppText variant="body" tone="muted">
          Remembered it?{" "}
          <AppText
            variant="body"
            tone="primary"
            style={{ fontWeight: "700" }}
            onPress={() => router.replace("/(auth)/sign-in")}
          >
            Sign in
          </AppText>
        </AppText>
      }
    >
      <Input
        label="Email"
        required
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="you@band.com"
        icon={<MailIcon size={16} color={Theme.colors.textFaint} />}
        error={errors.email?.message}
        onSubmitEditing={() => void onSubmit()}
        {...register("email", { validate: (value) => validateEmail(value) ?? true })}
      />

      {formError ? (
        <AppText variant="caption" tone="danger" accessibilityRole="alert">
          {formError}
        </AppText>
      ) : null}

      <Button label="Send reset link" full size="lg" loading={isSubmitting} onPress={() => void onSubmit()} />
    </AuthLayout>
  )
}
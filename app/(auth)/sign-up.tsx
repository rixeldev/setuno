import React, { useState } from "react"
import { Link, useRouter } from "expo-router"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { View } from "react-native"

import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { AppText } from "@/components/ui/AppText"
import { AuthLayout } from "@/components/app/AuthLayout"
import { LockIcon, MailIcon, UserIcon } from "@/components/ui/Icons"
import { Theme } from "@/constants/Theme"
import { useAuth } from "@/hooks/useAuth"
import { toFriendlyError } from "@/services/errors"
import { validateEmail, validatePassword, validateRequired } from "@/libs/validation"

interface FormValues {
  displayName: string
  email: string
  password: string
  confirm: string
}

/** Account creation (docs §5) followed by band onboarding. */
export default function SignUp() {
  const router = useRouter()
  const { t } = useTranslation()
  const { signUp, signInWithGoogle } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  const onGoogle = async () => {
    setFormError(null)
    setGoogleLoading(true)
    try {
      const completed = await signInWithGoogle()
      // Returning `false` means the picker was dismissed: stay on the form.
      if (completed) router.replace("/")
    } catch (error) {
      setFormError(toFriendlyError(error, t("auth.couldNotSignInGoogle")))
    } finally {
      setGoogleLoading(false)
    }
  }

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { displayName: "", email: "", password: "", confirm: "" },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await signUp({ email: values.email, password: values.password, displayName: values.displayName })
      router.replace("/")
    } catch (error) {
      setFormError(toFriendlyError(error, t("auth.couldNotCreateAccount")))
    }
  })

  return (
    <AuthLayout
      title={t("auth.createYourAccount")}
      subtitle={t("auth.signUpSubtitle")}
      back
      footer={
        <AppText variant="body" tone="muted">
          {t("auth.alreadyHaveAccountQuestion")}{" "}
          <Link href="/(auth)/sign-in" style={{ color: Theme.colors.primary, fontWeight: "700" }}>
            {t("auth.signIn")}
          </Link>
        </AppText>
      }
    >
      <Input
        label={t("auth.fullName")}
        required
        autoCapitalize="words"
        textContentType="name"
        placeholder="Alex Rivera"
        icon={<UserIcon size={16} color={Theme.colors.textFaint} />}
        error={errors.displayName?.message}
        {...register("displayName", {
          validate: (value) => validateRequired(value, t("auth.nameHint")) ?? true,
        })}
      />

      <Input
        label={t("auth.email")}
        required
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@band.com"
        icon={<MailIcon size={16} color={Theme.colors.textFaint} />}
        error={errors.email?.message}
        {...register("email", { validate: (value) => validateEmail(value, t("auth.email")) ?? true })}
      />

      <Input
        label={t("auth.password")}
        required
        secure
        textContentType="newPassword"
        placeholder={t("auth.passwordPlaceholder")}
        icon={<LockIcon size={16} color={Theme.colors.textFaint} />}
        error={errors.password?.message}
        {...register("password", { validate: (value) => validatePassword(value, t("auth.password")) ?? true })}
      />

      <Input
        label={t("auth.confirmPassword")}
        required
        secure
        textContentType="newPassword"
        onSubmitEditing={() => void onSubmit()}
        error={errors.confirm?.message}
        {...register("confirm", {
          validate: (value) =>
            value === getValues("password") ? true : t("auth.passwordsDontMatch"),
        })}
      />

      {formError ? (
        <AppText variant="caption" tone="danger" accessibilityRole="alert">
          {formError}
        </AppText>
      ) : null}

      <Button
        label={t("auth.createAccount")}
        full
        size="lg"
        loading={isSubmitting}
        onPress={() => void onSubmit()}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: Theme.colors.borderSoft }} />
        <AppText variant="caption" tone="muted">
          {t("common.or")}
        </AppText>
        <View style={{ flex: 1, height: 1, backgroundColor: Theme.colors.borderSoft }} />
      </View>

      <Button
        label={t("auth.continueWithGoogle")}
        full
        variant="secondary"
        loading={googleLoading}
        onPress={() => void onGoogle()}
      />
    </AuthLayout>
  )
}
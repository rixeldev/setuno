import React, { useState } from "react"
import { Link, useRouter } from "expo-router"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { View } from "react-native"

import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { AppText } from "@/components/ui/AppText"
import { AuthLayout } from "@/components/app/AuthLayout"
import { MailIcon, LockIcon } from "@/components/ui/Icons"
import { Theme } from "@/constants/Theme"
import { useAuth } from "@/hooks/useAuth"
import { toFriendlyError } from "@/services/errors"
import { validateEmail, validatePassword } from "@/libs/validation"

interface FormValues {
  email: string
  password: string
}

/** Email + password sign-in (docs §5). */
export default function SignIn() {
  const router = useRouter()
  const { t } = useTranslation()
  const { signIn, signInWithGoogle } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  const onGoogle = async () => {
    setFormError(null)
    setGoogleLoading(true)
    try {
      const completed = await signInWithGoogle()
      // A dismissed picker returns `false` and simply leaves the form alone.
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
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { email: "", password: "" } })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await signIn(values.email, values.password)
      // The root gate redirects to the app (or onboarding) once the profile
      // and organization resolve.
      router.replace("/")
    } catch (error) {
      setFormError(toFriendlyError(error, t("auth.couldNotSignIn")))
    }
  })

  return (
    <AuthLayout
      title={t("auth.welcomeBack")}
      subtitle={t("auth.signInSubtitle")}
      footer={
        <View>
          <AppText variant="body" tone="muted">
            {t("auth.newToSetuno")}{" "}
            <Link href="/(auth)/sign-up" style={{ color: Theme.colors.primary, fontWeight: "700" }}>
              {t("auth.createAnAccount")}
            </Link>
          </AppText>
        </View>
      }
    >
      <Input
        label={t("auth.email")}
        required
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        placeholder="you@band.com"
        icon={<MailIcon size={16} color={Theme.colors.textFaint} />}
        error={errors.email?.message}
        {...register("email", {
          validate: (value) => validateEmail(value, t("auth.email")) ?? true,
        })}
      />

      <Input
        label={t("auth.password")}
        required
        secure
        textContentType="password"
        returnKeyType="go"
        placeholder="••••••••"
        icon={<LockIcon size={16} color={Theme.colors.textFaint} />}
        error={errors.password?.message}
        onSubmitEditing={() => void onSubmit()}
        {...register("password", {
          validate: (value) => validatePassword(value, t("auth.password")) ?? true,
        })}
      />

      <Link href="/(auth)/forgot-password">
        <AppText variant="caption" tone="primary" style={{ alignSelf: "flex-end" }}>
          {t("auth.forgotPassword")}
        </AppText>
      </Link>

      {formError ? (
        <AppText variant="caption" tone="danger" accessibilityRole="alert">
          {formError}
        </AppText>
      ) : null}

      <Button
        label={t("auth.signIn")}
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
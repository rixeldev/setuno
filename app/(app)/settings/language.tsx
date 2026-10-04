import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Card, Divider } from "@/components/ui/Card"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useToast } from "@/components/ui/Toast"
import { CheckIcon } from "@/components/ui/Icons"
import { LANGUAGE_NAMES, type LanguagePreference } from "@/libs/language"
import { setLanguagePreference, useLanguagePreference } from "@/services/i18next"

/**
 * Language settings (docs §32): follow the device language or pin one. The
 * choice is stored on the device and restored on every start-up.
 */
export default function LanguageSettings() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const toast = useToast()
  const preference = useLanguagePreference()

  const options: { value: LanguagePreference; label: string; hint?: string }[] = [
    { value: "device", label: t("settings.automatic"), hint: t("settings.automaticHint") },
    { value: "en", label: LANGUAGE_NAMES.en },
    { value: "es", label: LANGUAGE_NAMES.es },
  ]

  const select = async (value: LanguagePreference): Promise<void> => {
    if (value === preference) return
    try {
      await setLanguagePreference(value)
      toast.showSuccess(t("toasts.languageUpdated"))
    } catch {
      // The language still switches in memory; only persistence can fail.
      toast.showSuccess(t("toasts.languageUpdated"))
    }
  }

  return (
    <ScreenContainer
      back
      title={t("settings.languageSettings")}
      subtitle={t("settings.selectLanguage")}
      large
    >
      <Card style={styles.card}>
        {options.map((option, index) => (
          <React.Fragment key={option.value}>
            {index > 0 ? <Divider /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: preference === option.value }}
              accessibilityLabel={option.label}
              onPress={() => void select(option.value)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <View style={styles.optionBody}>
                <AppText variant="bodyStrong">{option.label}</AppText>
                {option.hint ? (
                  <AppText variant="caption" tone="muted">
                    {option.hint}
                  </AppText>
                ) : null}
              </View>
              {preference === option.value ? (
                <CheckIcon size={18} color={Theme.colors.primary} />
              ) : null}
            </Pressable>
          </React.Fragment>
        ))}
      </Card>

      <AppText variant="caption" tone="faint">
        {t("settings.languageHint")}
      </AppText>
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: 0 },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.s,
    },
    optionBody: { flex: 1, gap: 2, minWidth: 0 },
    pressed: { opacity: 0.6 },
  })

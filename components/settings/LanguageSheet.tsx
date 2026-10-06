import React from "react"
import { useTranslation } from "react-i18next"

import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import { useToast } from "@/components/ui/Toast"
import { getDeviceLanguage } from "@/libs/deviceLanguage"
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, resolveLanguage } from "@/libs/language"
import { setLanguagePreference, useLanguagePreference } from "@/services/i18next"

interface LanguageSheetProps {
  visible: boolean
  onClose: () => void
}

/**
 * Language picker (docs §32): Español / English. The first launch still follows
 * the device language until one of the two is chosen here.
 */
export function LanguageSheet({ visible, onClose }: LanguageSheetProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const preference = useLanguagePreference()
  const current = resolveLanguage(preference, getDeviceLanguage())

  const select = async (value: (typeof SUPPORTED_LANGUAGES)[number]): Promise<void> => {
    if (value === current) {
      onClose()
      return
    }
    try {
      await setLanguagePreference(value)
    } finally {
      toast.showSuccess(t("toasts.languageUpdated"))
      onClose()
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("settings.languageSettings")}
      subtitle={t("settings.selectLanguage")}
    >
      {SUPPORTED_LANGUAGES.map((code) => (
        <SheetOptionRow
          key={code}
          label={LANGUAGE_NAMES[code]}
          selected={current === code}
          onPress={() => void select(code)}
        />
      ))}
    </BottomSheet>
  )
}

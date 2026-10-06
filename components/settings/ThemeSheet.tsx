import React from "react"
import { useTranslation } from "react-i18next"

import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import { useToast } from "@/components/ui/Toast"
import { useAuth } from "@/hooks/useAuth"
import { APPEARANCE_MODES } from "@/libs/appearance"
import { updateCachedPreferences } from "@/services/prefs"
import { applyAppearanceMode, getAppearance, useThemeVersion } from "@/services/themeManager"
import { updatePreferences } from "@/services/users"
import type { AppearanceMode } from "@/interfaces"

const LABEL_KEYS: Record<AppearanceMode, string> = {
  dark: "settings.dark",
  light: "settings.light",
  system: "settings.system",
}

interface ThemeSheetProps {
  visible: boolean
  onClose: () => void
}

/** Theme picker (docs §33): Oscuro / Claro / Sistema. */
export function ThemeSheet({ visible, onClose }: ThemeSheetProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { profile } = useAuth()
  // Subscribes to palette changes so the check mark follows the selection.
  useThemeVersion()
  const appearance = getAppearance()

  const select = (mode: AppearanceMode): void => {
    applyAppearanceMode(mode)
    updateCachedPreferences({ appearance: mode })
    const uid = profile?.uid
    if (uid) {
      void updatePreferences(uid, { appearance: mode }).catch(() => undefined)
    }
    toast.showSuccess(t("toasts.appearanceUpdated"))
    onClose()
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("settings.appearance")}
      subtitle={t("settings.theme")}
    >
      {APPEARANCE_MODES.map((mode) => (
        <SheetOptionRow
          key={mode}
          label={t(LABEL_KEYS[mode])}
          selected={appearance.mode === mode}
          onPress={() => select(mode)}
        />
      ))}
    </BottomSheet>
  )
}

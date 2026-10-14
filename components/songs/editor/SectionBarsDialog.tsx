import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Chip } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { MAX_SECTION_BARS, clampSectionBars } from "@/libs/songUtils"

/** Quick counts bands reach for when a part is a tidy 4, 8, 12 or 16 bars. */
const PRESETS = [4, 8, 12, 16]

interface SectionBarsDialogProps {
  /** Label of the section being edited, shown in the title. */
  sectionLabel: string
  /** Current bar count, when the section already has one. */
  bars?: number
  /** Called with the new count, or `undefined` when the counter is cleared. */
  onSave: (bars: number | undefined) => void
  onCancel: () => void
}

/**
 * Optional per-section bar counter (roadmap #27). Mount it only while open so
 * the field starts from the section's current value — a fresh mount replaces
 * the setState-in-an-effect dance React lint rejects.
 */
export function SectionBarsDialog({
  sectionLabel,
  bars,
  onSave,
  onCancel,
}: SectionBarsDialogProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const [value, setValue] = useState(bars && bars > 0 ? String(bars) : "")
  const parsed = clampSectionBars(Number.parseInt(value, 10) || 0)

  return (
    <Dialog
      visible
      onClose={onCancel}
      title={t("songs.barsTitle", { section: sectionLabel })}
      description={t("songs.barsDescription")}
      confirmLabel={t("common.save")}
      cancelLabel={t("common.cancel")}
      onConfirm={() => onSave(parsed > 0 ? parsed : undefined)}
    >
      <View style={styles.body}>
        <Input
          label={t("songs.barsLabel")}
          value={value}
          onChangeText={(text) => setValue(text.replace(/[^0-9]/g, "").slice(0, 3))}
          placeholder="8"
          keyboardType="number-pad"
          returnKeyType="done"
          hint={t("songs.barsHint", { max: MAX_SECTION_BARS })}
        />
        <View style={styles.presets}>
          {PRESETS.map((preset) => (
            <Chip
              key={preset}
              label={String(preset)}
              tone="accent"
              selected={parsed === preset}
              onPress={() => setValue(String(preset))}
            />
          ))}
          <Chip
            label={t("songs.barsClear")}
            tone="default"
            selected={parsed === 0}
            onPress={() => setValue("")}
          />
        </View>
        <AppText variant="caption" tone="faint">
          {parsed > 0 ? t("songs.barsPreview", { count: parsed }) : t("songs.barsHint", { max: MAX_SECTION_BARS })}
        </AppText>
      </View>
    </Dialog>
  )
}

const createStyles = () =>
  StyleSheet.create({
    body: { gap: Theme.spacing.m },
    presets: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.s },
  })

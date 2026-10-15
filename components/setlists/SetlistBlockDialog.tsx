import React from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { Chip } from "@/components/ui/Card"
import { MAX_BLOCK_NAME } from "@/libs/setlistBlocks"

/** The four names a band reaches for first (roadmap #43), as i18n keys. */
const PRESETS = [
  "setlists.blockSet1",
  "setlists.blockSet2",
  "setlists.blockBreak",
  "setlists.blockEncore",
] as const

export interface SetlistBlockDialogProps {
  visible: boolean
  /** "insert" adds one after a song; "rename" rewrites the divider picked. */
  mode: "insert" | "rename"
  /** Controlled text: the parent seeds it in the handler that opens the
   *  dialog, so no effect ever has to sync state when `visible` flips (the
   *  React Compiler lint rejects exactly that). */
  name: string
  onChangeName: (name: string) => void
  onClose: () => void
  onSubmit: (name: string) => void
}

/**
 * Asks what to call a divider of the running order — the preset chips are the
 * fast path ("Set 1", "Break", "Encore"), the field accepts anything else.
 * Empty names are refused here (confirm disabled) rather than dropped later:
 * an unnamed divider is not a divider, and the band should find that out
 * before the write, not after.
 */
export function SetlistBlockDialog({
  visible,
  mode,
  name,
  onChangeName,
  onClose,
  onSubmit,
}: SetlistBlockDialogProps) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={mode === "insert" ? t("setlists.addBlock") : t("setlists.renameBlock")}
      description={t("setlists.blockHint")}
      confirmLabel={mode === "insert" ? t("setlists.addBlock") : t("common.save")}
      confirmDisabled={name.trim().length === 0}
      onConfirm={() => onSubmit(name)}
    >
      <Input
        label={t("setlists.blockName")}
        placeholder={t("setlists.blockPlaceholder")}
        value={name}
        onChangeText={onChangeName}
        maxLength={MAX_BLOCK_NAME}
        autoCapitalize="words"
        returnKeyType="done"
      />
      <View style={styles.presets}>
        {PRESETS.map((key) => (
          <Chip
            key={key}
            label={t(key)}
            size="sm"
            onPress={() => onChangeName(t(key))}
          />
        ))}
      </View>
    </Dialog>
  )
}

const createStyles = () =>
  StyleSheet.create({
    presets: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Theme.spacing.xs,
    },
  })

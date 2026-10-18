import React from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { EditIcon } from "@/components/ui/Icons"
import { useEditPresence } from "@/hooks/useEditPresence"

/**
 * The soft "somebody else is in here" line (roadmap #28): informational, never
 * a lock — the edit keeps going either way. It stays mounted for as long as
 * the editor does (its heartbeat is the hook's) and renders nothing when
 * nobody else is inside, so the flow is only ever interrupted by the warning
 * itself. The live region lets a screen reader hear it arrive politely.
 */
export const EditingPresenceNotice = ({
  songId,
}: {
  songId: string
}): React.ReactElement | null => {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const editors = useEditPresence(songId)

  if (editors.length === 0) return null

  const first = editors[0]
  const message =
    first && editors.length === 1
      ? t("songs.editingOne", { name: first.displayName })
      : t("songs.editingMany", { names: editors.map((entry) => entry.displayName).join(", ") })

  return (
    <View style={styles.row} accessible accessibilityLiveRegion="polite">
      <EditIcon size={14} color={Theme.colors.accent} />
      <AppText variant="caption" tone="accent" style={styles.text}>
        {message}
      </AppText>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.xs,
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: Theme.spacing.xs,
      backgroundColor: Theme.colors.chrome,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Theme.colors.border,
    },
    text: { flex: 1 },
  })

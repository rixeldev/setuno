import React from "react"
import { Linking, Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { FilePdfIcon, LinkIcon, OpenExternalIcon } from "@/components/ui/Icons"
import type { SongAttachment } from "@/interfaces"

interface SongAttachmentsProps {
  attachments: SongAttachment[] | null | undefined
}

/**
 * The song's attachments in the reader (roadmap #40): one chip per PDF or
 * link that opens in the platform's viewer/browser — same hand-off contract
 * as `SongLinks`, nothing embedded, so no service terms are bent. Renders
 * nothing when the song carries none (every document written before #40).
 */
export function SongAttachments({ attachments }: SongAttachmentsProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const entries = attachments ?? []

  if (entries.length === 0) return null

  return (
    <View style={styles.row}>
      {entries.map((entry) => (
        <Pressable
          key={entry.id}
          accessibilityRole="link"
          accessibilityLabel={t("attachments.openA11y", { name: entry.name })}
          onPress={() => void Linking.openURL(entry.url).catch(() => undefined)}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          {entry.kind === "file" ? (
            <FilePdfIcon size={16} color={Theme.colors.accent} />
          ) : (
            <LinkIcon size={16} color={Theme.colors.accent} />
          )}
          <AppText variant="caption" tone="accent" numberOfLines={1} style={styles.name}>
            {entry.name}
          </AppText>
          <OpenExternalIcon size={13} color={Theme.colors.textMuted} />
        </Pressable>
      ))}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Theme.spacing.s,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: 8,
      borderRadius: Theme.radii.pill,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.surface,
      maxWidth: "100%",
    },
    name: {
      flexShrink: 1,
    },
    pressed: { opacity: 0.7 },
  })

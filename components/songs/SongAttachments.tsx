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
 * The song's attachments in the reader (roadmap #40): one row per PDF or link
 * that opens in the platform's viewer/browser — same hand-off contract as
 * `SongLinks`, nothing embedded, so no service terms are bent.
 *
 * A row, not a chip: an attachment is a document with a name and sometimes a
 * note ("chart in Bb", "rehearsal take"), so it reads like a file in a list
 * instead of a pill that truncates the one thing that identifies it. Renders
 * nothing when the song carries none (every document written before #40).
 */
export function SongAttachments({ attachments }: SongAttachmentsProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const entries = attachments ?? []

  if (entries.length === 0) return null

  return (
    <View style={styles.list}>
      {entries.map((entry, index) => (
        <Pressable
          key={entry.id}
          accessibilityRole="link"
          accessibilityLabel={t("attachments.openA11y", { name: entry.name })}
          onPress={() => void Linking.openURL(entry.url).catch(() => undefined)}
          style={({ pressed }) => [
            styles.row,
            index > 0 && styles.divider,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.iconWrap}>
            {entry.kind === "file" ? (
              <FilePdfIcon size={16} color={Theme.colors.accent} />
            ) : (
              <LinkIcon size={16} color={Theme.colors.accent} />
            )}
          </View>
          <View style={styles.body}>
            <AppText variant="caption" numberOfLines={1}>
              {entry.name}
            </AppText>
            {entry.note ? (
              <AppText variant="caption" tone="faint" numberOfLines={1}>
                {entry.note}
              </AppText>
            ) : null}
          </View>
          <OpenExternalIcon size={13} color={Theme.colors.textFaint} />
        </Pressable>
      ))}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    list: {
      borderRadius: Theme.radii.m,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.surface,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: 10,
    },
    divider: {
      borderTopWidth: 1,
      borderTopColor: Theme.colors.borderSoft,
    },
    iconWrap: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: Theme.radii.s,
      backgroundColor: Theme.colors.accentSoft,
    },
    body: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.7 },
  })

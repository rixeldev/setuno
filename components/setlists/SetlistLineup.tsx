import React from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Avatar } from "@/components/ui/Avatar"
import { bandRoleLabel } from "@/libs/bandRoles"
import type { LineupEntry } from "@/libs/bandRoles"

interface SetlistLineupProps {
  /** The cast already resolved against the live roster (`resolveLineup`). */
  entries: readonly LineupEntry[]
}

/**
 * One song's cast in the running order (roadmap #88): a chip per player with
 * their avatar, name and the chair they take **on this song**.
 *
 * It replaced a single wrapped caption ("Voz principal: Julia · Guitarra:
 * Manuel") because that line was the hardest thing on the row to read: the
 * roles and the names ran together, and on a phone the second member was
 * usually cut off. A chip keeps one person in one place, and the wrap gives
 * every additional player its own space instead of squeezing the row.
 *
 * The chips are presentational: the song row around them owns the tap that
 * opens the reader. Each chip carries the same "role: name" pair the reader and
 * the printed sheet use, so a screen reader hears one player at a time.
 */
export function SetlistLineup({ entries }: SetlistLineupProps) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)

  const visible = entries.filter((entry) => bandRoleLabel(entry.role, t).length > 0)
  if (visible.length === 0) return null

  return (
    <View style={styles.wrap}>
      {visible.map((entry) => {
        const role = bandRoleLabel(entry.role, t)
        return (
          <View
            key={entry.uid}
            accessible
            accessibilityLabel={t("setlists.lineupPair", { role, name: entry.name })}
            style={styles.chip}
          >
            <Avatar name={entry.name} photoURL={entry.photoURL} size={20} />
            <View style={styles.chipText}>
              <AppText variant="caption" numberOfLines={1}>
                {entry.name}
              </AppText>
              <AppText variant="caption" tone="faint" numberOfLines={1}>
                {role}
              </AppText>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Theme.spacing.xs,
      marginTop: Theme.spacing.xs,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      maxWidth: "100%",
      paddingLeft: 3,
      paddingRight: Theme.spacing.s,
      paddingVertical: 3,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.background2,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
    },
    chipText: { flexShrink: 1, minWidth: 0 },
  })

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
  /**
   * Where the strip sits: the running order's card (surface) or the reader's
   * page (background). The ring between two faces is painted in that colour,
   * so the overlap reads as one stack instead of two bordered circles.
   */
  onPage?: boolean
}

/** Faces before the stack collapses into a "+N" bubble. */
const MAX_FACES = 4

/**
 * One song's cast in the running order (roadmap #88), as a compact strip: the
 * players' faces stacked on the left and the chairs they take on the right.
 *
 * The first version printed a chip per player — avatar, name and role — and a
 * song with four players grew the row by three lines. The row is about the
 * *song*; the cast is context. So the faces are overlapped into one 24 pt
 * stack (the pattern every calendar and chat list uses for "who is in"), the
 * roles collapse into a single ellipsised caption, and the names stay in the
 * accessibility label: a bandmate recognises the faces, a screen reader hears
 * every "role: name" pair exactly as the reader and the printed sheet do.
 */
export function SetlistLineup({ entries, onPage = false }: SetlistLineupProps) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const ring = onPage ? Theme.colors.background : Theme.colors.surface

  const visible = entries.filter((entry) => bandRoleLabel(entry.role, t).length > 0)
  if (visible.length === 0) return null

  const faces = visible.slice(0, MAX_FACES)
  const hidden = visible.length - faces.length
  const roles = visible.map((entry) => bandRoleLabel(entry.role, t)).join(" · ")
  const label = visible
    .map((entry) =>
      t("setlists.lineupPair", { role: bandRoleLabel(entry.role, t), name: entry.name }),
    )
    .join(", ")

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={styles.row}
    >
      <View style={styles.stack}>
        {faces.map((entry, index) => (
          <View
            key={entry.uid}
            style={[styles.face, { borderColor: ring, backgroundColor: ring }, index > 0 && styles.overlap]}
          >
            <Avatar name={entry.name} photoURL={entry.photoURL} size={22} maxInitials={1} />
          </View>
        ))}
        {hidden > 0 ? (
          <View
            style={[
              styles.face,
              styles.more,
              { borderColor: ring, backgroundColor: ring },
              styles.overlap,
            ]}
          >
            <AppText variant="caption" tone="muted" style={styles.moreText}>
              {`+${hidden}`}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.roles}>
        {roles}
      </AppText>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      marginTop: 6,
    },
    stack: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
    // A ring in the surrounding colour, so two overlapping faces stay separate
    // without a shadow or a second colour. The colour itself comes from the
    // surface the strip sits on (see `onPage`).
    face: {
      borderRadius: Theme.radii.pill,
      borderWidth: 2,
    },
    overlap: { marginLeft: -8 },
    more: {
      width: 26,
      height: 26,
      alignItems: "center",
      justifyContent: "center",
    },
    moreText: { fontSize: 10 },
    roles: { flex: 1, minWidth: 0 },
  })

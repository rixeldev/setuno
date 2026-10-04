import React from "react"
import { StyleSheet, View } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card } from "@/components/ui/Card"
import { ChevronRightIcon, MusicIcon } from "@/components/ui/Icons"
import { formatDuration, formatRelativeTime, pluralize } from "@/libs/format"
import { toDate } from "@/interfaces/timestamp"
import { countSongChords, countSongLines, estimateDurationSec } from "@/libs/songUtils"
import type { Song } from "@/interfaces"

interface SongRowProps {
  song: Song
  onPress: () => void
  /** Optional trailing element (menu button, checkbox). */
  right?: React.ReactNode
  /** Compact rows are used in setlists and pickers. */
  dense?: boolean
}

/** One song in a list: title, artist, key and quick stats (docs §19). */
export function SongRow({ song, onPress, right, dense = false }: SongRowProps) {
  const styles = useThemedStyles(createStyles)
  const duration = song.durationSec ?? (song.sections.length > 0 ? estimateDurationSec(song.sections) : null)

  return (
    <Card
      padded={false}
      onPress={onPress}
      accessibilityLabel={`${song.title}${song.artist ? ` by ${song.artist}` : ""}, key ${song.key || "unknown"}`}
      style={dense ? styles.dense : undefined}
    >
      <View style={styles.row}>
        <View style={styles.artwork}>
          <MusicIcon size={18} color={Theme.colors.primary} />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.title}>
              {song.title}
            </AppText>
            {song.key ? <Badge label={song.key} tone="accent" /> : null}
          </View>

          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {song.artist || "Unknown artist"}
            {song.genre ? ` · ${song.genre}` : ""}
            {song.bpm ? ` · ${song.bpm} BPM` : ""}
          </AppText>

          {!dense ? (
            <AppText variant="caption" tone="faint" numberOfLines={1}>
              {pluralize(countSongLines(song.sections), "line")} ·{" "}
              {pluralize(countSongChords(song.sections), "chord")} · {formatDuration(duration)} · updated{" "}
              {formatRelativeTime(toDate(song.updatedAt))}
            </AppText>
          ) : null}
        </View>

        {right ?? <ChevronRightIcon size={16} color={Theme.colors.textFaint} />}
      </View>
    </Card>
  )
}

const createStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      padding: Theme.spacing.m,
    },
    dense: { borderRadius: Theme.radii.m },
    artwork: {
      width: 40,
      height: 40,
      borderRadius: Theme.radii.m,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.primarySoft,
    },
    body: { flex: 1, minWidth: 0, gap: 2 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    title: { flex: 1 },
  })
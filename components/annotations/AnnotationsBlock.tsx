import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Card } from "@/components/ui/Card"
import { ChevronRightIcon, NoteIcon } from "@/components/ui/Icons"
import { markerAnchorLabel, markerPlacements, sortMarkerPlacements } from "@/libs/annotations"
import type { AnnotationMarker, SongAnnotation, SongSection } from "@/interfaces"

interface AnnotationsBlockProps {
  annotation: SongAnnotation | null
  sections: SongSection[]
  songTitle: string
  onOpen: () => void
}

/**
 * End-of-song block with the reader's personal notes (roadmap #3): the
 * free-form notes plus every inline marker, each with its anchor. Lives below
 * the lyrics; tapping it opens the annotations editor. The inline chips next
 * to the anchored lines are rendered by `SongContent`.
 */
export function AnnotationsBlock({
  annotation,
  sections,
  songTitle,
  onOpen,
}: AnnotationsBlockProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()

  // Loading: nothing to show yet, so the reader does not flash a block.
  if (!annotation) return null

  const placements = sortMarkerPlacements(markerPlacements(annotation.markers, sections))
  const hasNotes = annotation.notes.trim().length > 0
  if (placements.length === 0 && !hasNotes) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("annotations.addNotesA11y", { title: songTitle })}
        onPress={onOpen}
        style={({ pressed }) => [styles.emptyRow, pressed && styles.pressed]}
      >
        <NoteIcon size={16} color={Theme.colors.primary} />
        <View style={styles.flex}>
          <AppText variant="caption" tone="muted">
            {t("annotations.personalNotes")}
          </AppText>
          <AppText variant="caption" tone="faint">
            {t("annotations.noneYet")}
          </AppText>
        </View>
        <ChevronRightIcon size={16} color={Theme.colors.textFaint} />
      </Pressable>
    )
  }

  const total = placements.length + (hasNotes ? 1 : 0)

  return (
    <Card
      onPress={onOpen}
      accessibilityLabel={t("annotations.openA11y", { title: songTitle, count: total })}
    >
      <View style={styles.header}>
        <NoteIcon size={16} color={Theme.colors.primary} />
        <AppText variant="label" tone="primary" style={styles.flex}>
          {t("annotations.personalNotes")}
        </AppText>
        <AppText variant="caption" tone="faint">
          {t("annotations.count", { count: total })}
        </AppText>
      </View>

      {hasNotes ? (
        <AppText variant="body" tone="muted" numberOfLines={3}>
          {annotation.notes}
        </AppText>
      ) : null}

      {placements.map(({ marker }) => (
        <MarkerRow key={marker.id} marker={marker} sections={sections} />
      ))}
    </Card>
  )
}

/** One inline note with its anchor label ("Verse 2 · line 3"). */
function MarkerRow({ marker, sections }: { marker: AnnotationMarker; sections: SongSection[] }) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  return (
    <View style={styles.marker}>
      <AppText variant="caption" tone="accent" numberOfLines={1}>
        {markerAnchorLabel(marker, sections, t)}
      </AppText>
      <AppText variant="body" numberOfLines={2}>
        {marker.text}
      </AppText>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.7 },
    emptyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.m,
      paddingHorizontal: Theme.spacing.l,
      borderRadius: Theme.radii.lg,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.surface,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
    },
    marker: { gap: 2 },
  })
import React from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import type { SongInput } from "@/interfaces"
import { diffWords } from "@/libs/songDiff"
import type { VersionDiff, VersionDiffFieldKey } from "@/libs/songHistory"
import { sectionLabelFor } from "@/libs/songUtils"
import { AppText } from "@/components/ui/AppText"
import { DiffText } from "@/components/ui/DiffText"

interface SongVersionDiffProps {
  diff: VersionDiff
  /** The older side — the version — kept whole so its labels resolve. */
  before: SongInput
  /** The newer side — the song as it is now. */
  after: SongInput
}

/**
 * Renders one version's diff against the current song (roadmap #26), reusing
 * the same runs the suggestion review draws (`libs/songDiff.ts` →
 * `DiffText`): kept text plain, what the version had and the song lost
 * struck through, what the song gained since then on the accent. Sections
 * are labelled through the same `sectionLabelFor` the reader uses, so a
 * header reads "Verse 2" on both sides.
 */
export function SongVersionDiff({ diff, before, after }: SongVersionDiffProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()

  const fieldLabel = (field: VersionDiffFieldKey): string => {
    switch (field) {
      case "title":
        return t("songs.songTitle")
      case "artist":
        return t("songs.artist")
      case "key":
        return t("songs.key")
      case "capo":
        return t("songs.capo")
      case "bpm":
        return t("songs.bpm")
      case "genre":
        return t("songs.genre")
      case "notes":
        return t("songs.notes")
      case "tags":
        return t("songs.tags")
      case "status":
        return t("songs.status")
    }
  }

  const labelOf = (id: string, side: "before" | "after"): string => {
    const sections = side === "before" ? before.sections : after.sections
    const index = sections.findIndex((section) => section.id === id)
    return index < 0 ? "" : sectionLabelFor(sections, index, t)
  }

  if (!diff.changed) {
    return (
      <AppText variant="body" tone="muted">
        {t("songs.historyNoChanges")}
      </AppText>
    )
  }

  return (
    <View style={styles.container}>
      {diff.fields.map((field) => (
        <View key={field.field} style={styles.field}>
          <AppText variant="caption" tone="muted">
            {fieldLabel(field.field)}
          </AppText>
          <DiffText segments={field.segments} />
        </View>
      ))}

      {diff.sections.map((section) => {
        const sectionId = (section.after ?? section.before)?.id ?? ""
        const beforeLabel = section.before ? labelOf(section.before.id, "before") : ""
        const afterLabel = section.after ? labelOf(section.after.id, "after") : ""
        return (
          <View key={sectionId} style={styles.section}>
            {beforeLabel === afterLabel ? (
              <AppText variant="body">{afterLabel}</AppText>
            ) : (
              <DiffText segments={diffWords(beforeLabel, afterLabel)} />
            )}

            {section.lines.map((line, index) => (
              <View key={index} style={styles.line}>
                {line.chords && line.chords.length > 0 ? (
                  <DiffText segments={line.chords} mono />
                ) : null}
                {line.lyrics.length > 0 ? <DiffText segments={line.lyrics} /> : null}
              </View>
            ))}
          </View>
        )
      })}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    container: { gap: Theme.spacing.m },
    field: { gap: 2 },
    section: {
      gap: Theme.spacing.xs,
      paddingTop: Theme.spacing.s,
      borderTopWidth: 1,
      borderTopColor: Theme.colors.borderSoft,
    },
    line: { gap: 2 },
  })

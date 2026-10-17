import React from "react"
import { StyleSheet, Text } from "react-native"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { splitMentions, type MentionMember } from "@/functions/src/mentions"

/**
 * A comment body with its `@mentions` lit on the accent (roadmap #58). The
 * segments come from `mentions.ts` — the very parser the push trigger runs —
 * so what glows here is exactly what pinged the bandmate, and a handle that
 * matches nobody stays ordinary text. Spans are plain `Text`, not `AppText`,
 * for the same reason `DiffText`'s are: the outer `AppText` owns the type
 * scale, a span re-applying it would fight the line height mid-sentence.
 */
export function MentionText({
  body,
  members,
}: {
  body: string
  /** Roster the handles resolve against — already filtered to collaborators. */
  members: readonly MentionMember[]
}) {
  const styles = useThemedStyles(createStyles)
  const segments = splitMentions(body, members)

  return (
    <AppText variant="body">
      {segments.map((segment, index) =>
        segment.uid !== null ?
          <Text key={index} style={styles.mention}>
            {segment.text}
          </Text>
        : (
          segment.text
        ),
      )}
    </AppText>
  )
}

const createStyles = () =>
  StyleSheet.create({
    mention: {
      color: Theme.colors.accent,
      backgroundColor: Theme.colors.accentSoft,
      fontWeight: "600",
    },
  })

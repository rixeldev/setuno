import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card, Chip } from "@/components/ui/Card"
import { IconButton } from "@/components/ui/Button"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { ChatIcon, PlusIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { formatRelativeTime, pluralize } from "@/libs/format"
import { toDate } from "@/interfaces/timestamp"
import type { SuggestionStatus } from "@/interfaces"

type Filter = SuggestionStatus | "mine" | "all"

const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "mine", label: "Mine" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
]

const STATUS_TONES: Record<SuggestionStatus, "accent" | "success" | "danger"> = {
  pending: "accent",
  accepted: "success",
  rejected: "danger",
}

/** Suggestion inbox: members track their requests, admins review them (docs §13, §15). */
export default function SuggestionsScreen() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const { profile } = useAuth()
  const { isAdmin } = useOrganization()
  const { suggestions, pendingSuggestions, loading, error } = useOrgData()
  const [filter, setFilter] = useState<Filter>(isAdmin ? "pending" : "mine")

  const visible = useMemo(() => {
    if (filter === "all") return suggestions
    if (filter === "mine") return suggestions.filter((entry) => entry.authorId === profile?.uid)
    return suggestions.filter((entry) => entry.status === filter)
  }, [suggestions, filter, profile?.uid])

  return (
    <ScreenContainer
      title="Suggestions"
      subtitle={
        loading
          ? "Loading suggestions…"
          : isAdmin
            ? `${pluralize(pendingSuggestions.length, "suggestion")} waiting for review`
            : "Track the changes you asked for"
      }
      large
      headerRight={
        <IconButton
          label="Suggest a new song"
          variant="secondary"
          onPress={() => router.push("/suggestions/new")}
          icon={<PlusIcon size={18} color={Theme.colors.text} />}
        />
      }
      toolbar={
        <View style={styles.segment}>
          {FILTERS.map((entry) => (
            <Chip
              key={entry.key}
              label={entry.label}
              tone="primary"
              selected={filter === entry.key}
              onPress={() => setFilter(entry.key)}
            />
          ))}
        </View>
      }
    >
      {error ? <ErrorState message={error} /> : null}

      {loading ? (
        <SkeletonList count={3} height={86} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<ChatIcon size={24} color={Theme.colors.primary} />}
          title={emptyTitle(filter, isAdmin)}
          message={
            filter === "mine"
              ? "Open any song and tap \"Suggest a change\" if a chord or lyric looks wrong."
              : "When a band member suggests a change, it lands here for an admin to review."
          }
          actionLabel={filter === "mine" ? "Browse songs" : "Suggest a new song"}
          onAction={() => router.push(filter === "mine" ? "/songs" : "/suggestions/new")}
        />
      ) : (
        <View style={styles.list}>
          {visible.map((suggestion) => (
            <Card
              key={suggestion.id}
              onPress={() => router.push(`/suggestions/${suggestion.id}`)}
              accessibilityLabel={`Suggestion on ${suggestion.songTitle || "a new song"} by ${suggestion.authorName}`}
              style={{ gap: Theme.spacing.s }}
            >
              <View style={styles.row}>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {suggestion.songTitle || "New song"}
                  </AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {suggestion.authorName} · {formatRelativeTime(toDate(suggestion.createdAt))}
                  </AppText>
                </View>
                <Badge label={suggestion.status} tone={STATUS_TONES[suggestion.status]} />
              </View>

              <AppText variant="caption" tone="faint" numberOfLines={2}>
                {suggestion.summary}
              </AppText>

              {suggestion.comment.trim().length > 0 ? (
                <AppText variant="caption" tone="muted" numberOfLines={2}>
                  “{suggestion.comment}”
                </AppText>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </ScreenContainer>
  )
}

const emptyTitle = (filter: Filter, isAdmin: boolean): string => {
  if (filter === "mine") return "No suggestions yet"
  if (filter === "pending") return isAdmin ? "Nothing to review" : "No pending suggestions"
  return "Nothing here yet"
}

const createStyles = () =>
  StyleSheet.create({
    segment: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      alignSelf: "flex-start",
      padding: 4,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.surfaceHigh,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
    },
    list: { gap: Theme.spacing.m },
    row: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    flex: { flex: 1, minWidth: 0 },
  })
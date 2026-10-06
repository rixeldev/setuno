import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card, Chip } from "@/components/ui/Card"
import { IconButton } from "@/components/ui/Button"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { ChatIcon, PlusIcon } from "@/components/ui/Icons"
import { ModalScreen } from "@/components/app/ModalScreen"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { formatRelativeTime } from "@/libs/format"
import { toDate } from "@/interfaces/timestamp"
import type { SuggestionStatus } from "@/interfaces"

type Filter = SuggestionStatus | "mine" | "all"

const FILTERS: { key: Filter; labelKey: string }[] = [
  { key: "pending", labelKey: "suggestions.pending" },
  { key: "mine", labelKey: "suggestions.mine" },
  { key: "accepted", labelKey: "suggestions.accepted" },
  { key: "rejected", labelKey: "suggestions.rejected" },
  { key: "all", labelKey: "suggestions.all" },
]

const STATUS_TONES: Record<SuggestionStatus, "accent" | "success" | "danger"> = {
  pending: "accent",
  accepted: "success",
  rejected: "danger",
}

/** Suggestion inbox: members track their requests, admins review them (docs §13, §15). */
export default function SuggestionsScreen() {
  const { t } = useTranslation()
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
    <ModalScreen
      title={t("suggestions.suggestions")}
      subtitle={
        loading
          ? t("suggestions.loading")
          : isAdmin
            ? t("suggestions.pendingCount", { count: pendingSuggestions.length })
            : t("suggestions.memberSubtitle")
      }
      headerRight={
        <IconButton
          label={t("suggestions.suggestNewSong")}
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
              label={t(entry.labelKey)}
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
          title={t(emptyTitleKey(filter, isAdmin))}
          message={filter === "mine" ? t("suggestions.mineEmptyHint") : t("suggestions.adminEmptyHint")}
          actionLabel={filter === "mine" ? t("suggestions.browseSongs") : t("suggestions.suggestNewSong")}
          onAction={() => router.push(filter === "mine" ? "/songs" : "/suggestions/new")}
        />
      ) : (
        <View style={styles.list}>
          {visible.map((suggestion) => (
            <Card
              key={suggestion.id}
              onPress={() => router.push(`/suggestions/${suggestion.id}`)}
              accessibilityLabel={t("suggestions.cardA11y", {
                song: suggestion.songTitle || t("suggestions.newSongLower"),
                author: suggestion.authorName,
              })}
              style={{ gap: Theme.spacing.s }}
            >
              <View style={styles.row}>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {suggestion.songTitle || t("suggestions.newSong")}
                  </AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {suggestion.authorName} · {formatRelativeTime(toDate(suggestion.createdAt))}
                  </AppText>
                </View>
                <Badge label={t(`suggestions.${suggestion.status}`)} tone={STATUS_TONES[suggestion.status]} />
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
    </ModalScreen>
  )
}

const emptyTitleKey = (filter: Filter, isAdmin: boolean): string => {
  if (filter === "mine") return "suggestions.noSuggestions"
  if (filter === "pending") return isAdmin ? "suggestions.nothingToReview" : "suggestions.noPending"
  return "common.empty"
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
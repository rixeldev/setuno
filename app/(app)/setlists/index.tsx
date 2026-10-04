import React from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card } from "@/components/ui/Card"
import { IconButton } from "@/components/ui/Button"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { ListIcon, PlusIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { formatDurationLong, formatRelativeDay, pluralize } from "@/libs/format"
import { parseIsoDate } from "@/libs/validation"

/** Reusable running orders for gigs and rehearsals (docs §20). */
export default function SetlistsScreen() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const { isAdmin } = useOrganization()
  const { setlists, loading, error } = useOrgData()

  return (
    <ScreenContainer
      title="Setlists"
      subtitle={loading ? "Loading setlists…" : pluralize(setlists.length, "setlist")}
      large
      headerRight={
        isAdmin ? (
          <IconButton
            label="New setlist"
            variant="secondary"
            onPress={() => router.push("/setlists/new")}
            icon={<PlusIcon size={18} color={Theme.colors.text} />}
          />
        ) : null
      }
    >
      {error ? <ErrorState message={error} /> : null}

      {loading ? (
        <SkeletonList count={3} height={96} />
      ) : setlists.length === 0 ? (
        <EmptyState
          icon={<ListIcon size={24} color={Theme.colors.primary} />}
          title="No setlists yet"
          message={
            isAdmin
              ? "A setlist is a running order you can reuse for every gig. Start with your next show."
              : "No setlists yet. An admin can build the running order for each show."
          }
          actionLabel={isAdmin ? "Create a setlist" : undefined}
          onAction={isAdmin ? () => router.push("/setlists/new") : undefined}
        />
      ) : (
        <View style={styles.list}>
          {setlists.map((setlist) => (
            <Card
              key={setlist.id}
              onPress={() => router.push(`/setlists/${setlist.id}`)}
              accessibilityLabel={`${setlist.name}, ${pluralize(setlist.songs.length, "song")}`}
              style={{ gap: Theme.spacing.s }}
            >
              <View style={styles.row}>
                <AppText variant="subheading" numberOfLines={1} style={styles.flex}>
                  {setlist.name}
                </AppText>
                {setlist.date ? (
                  <Badge label={formatRelativeDay(parseIsoDate(setlist.date))} tone="primary" />
                ) : null}
              </View>

              {setlist.description.trim().length > 0 ? (
                <AppText variant="caption" tone="muted" numberOfLines={2}>
                  {setlist.description}
                </AppText>
              ) : null}

              <AppText variant="caption" tone="faint">
                {pluralize(setlist.songs.length, "song")} ·{" "}
                {formatDurationLong(setlist.estimatedDurationSec)}
              </AppText>
            </Card>
          ))}
        </View>
      )}
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    list: { gap: Theme.spacing.m },
    row: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    flex: { flex: 1, minWidth: 0 },
  })
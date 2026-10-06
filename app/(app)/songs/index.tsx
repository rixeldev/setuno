import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button, IconButton } from "@/components/ui/Button"
import { Chip } from "@/components/ui/Card"
import { SearchInput } from "@/components/ui/Input"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { FilterIcon, PlusIcon, SearchIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { SongRow } from "@/components/app/SongRow"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import {
  EMPTY_FILTERS,
  countActiveFilters,
  filterSongs,
  isFiltered,
  type SongFilters,
} from "@/libs/songSearch"
import type { SongFacets } from "@/interfaces"

type FacetKey = "artist" | "genre" | "key" | "tag"

/** Facet labels are i18n keys, resolved where they are rendered. */
const FACET_LABELS: Record<FacetKey, string> = {
  artist: "songs.artist",
  genre: "songs.genre",
  key: "songs.key",
  tag: "songs.tags",
}

const FACET_SOURCES: Record<FacetKey, (facets: SongFacets) => string[]> = {
  artist: (facets) => facets.artists,
  genre: (facets) => facets.genres,
  key: (facets) => facets.keys,
  tag: (facets) => facets.tags,
}

/** Songbook with instant search and facet filters (docs §33, §34). */
export default function SongsScreen() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const { isAdmin } = useOrganization()
  const { songs, facets, loading, error } = useOrgData()
  const [filters, setFilters] = useState<SongFilters>(EMPTY_FILTERS)
  const [facet, setFacet] = useState<FacetKey | null>(null)

  const results = useMemo(() => filterSongs(songs, filters), [songs, filters])
  const activeCount = countActiveFilters(filters)

  const setFacetValue = (key: FacetKey, value: string | null): void => {
    setFilters((current) => ({ ...current, [key]: current[key] === value ? null : value }))
  }

  const facetOptions: string[] = facet ? FACET_SOURCES[facet](facets) : []

  return (
    <ScreenContainer
      title={t("songs.songs")}
      subtitle={
        loading ? t("songs.loadingSongbook") : t("organizations.songsCount", { count: songs.length })
      }
      large
      headerRight={
        isAdmin ? (
          <IconButton
            label={t("songs.newSong")}
            variant="secondary"
            onPress={() => router.push("/songs/new")}
            icon={<PlusIcon size={18} color={Theme.colors.text} />}
          />
        ) : null
      }
      toolbar={
        <View style={styles.toolbar}>
          <View style={styles.searchRow}>
            <SearchInput
              label={t("common.search")}
              placeholder={t("songs.searchPlaceholder")}
              value={filters.search}
              onChangeText={(search) => setFilters((current) => ({ ...current, search }))}
              onClear={() => setFilters((current) => ({ ...current, search: "" }))}
              icon={<SearchIcon size={16} color={Theme.colors.textFaint} />}
              containerStyle={styles.search}
            />
            <Button
              label={
                activeCount > 0 ? t("songs.filtersCount", { count: activeCount }) : t("songs.filters")
              }
              variant={activeCount > 0 ? "primary" : "secondary"}
              icon={<FilterIcon size={15} color={activeCount > 0 ? Theme.colors.onPrimary : Theme.colors.text} />}
              onPress={() => setFacet(facet ?? "key")}
            />
          </View>

          {activeCount > 0 ? (
            <View style={styles.activeFilters}>
              {(["artist", "genre", "key", "tag"] as FacetKey[])
                .filter((key) => filters[key] !== null)
                .map((key) => (
                  <Chip
                    key={key}
                    label={`${t(FACET_LABELS[key])}: ${filters[key] ?? ""}`}
                    tone="primary"
                    size="sm"
                    onPress={() => setFacetValue(key, null)}
                    accessibilityLabel={t("songs.removeFilter", { filter: t(FACET_LABELS[key]) })}
                  />
                ))}
              <Chip
                label={t("songs.clearFilters")}
                size="sm"
                onPress={() => setFilters(EMPTY_FILTERS)}
              />
            </View>
          ) : null}
        </View>
      }
    >
      {error ? <ErrorState message={error} /> : null}

      {loading ? (
        <SkeletonList count={5} height={82} />
      ) : songs.length === 0 ? (
        <EmptyState
          title={t("songs.noSongs")}
          message={isAdmin ? t("songs.noSongsDescription") : t("songs.noLyricsMember")}
          actionLabel={isAdmin ? t("songs.addFirstSong") : undefined}
          onAction={isAdmin ? () => router.push("/songs/new") : undefined}
        />
      ) : results.length === 0 ? (
        <EmptyState
          title={t("songs.noResults")}
          message={t("songs.noResultsDescription")}
          actionLabel={isFiltered(filters) ? t("songs.clearFilters") : undefined}
          onAction={isFiltered(filters) ? () => setFilters(EMPTY_FILTERS) : undefined}
        />
      ) : (
        <View style={styles.list}>
          <AppText variant="caption" tone="faint">
            {t("organizations.songsCount", { count: results.length })}
            {results.length !== songs.length
              ? ` · ${t("organizations.songsCount", { count: songs.length })}`
              : ""}
          </AppText>
          {results.map((song) => (
            <SongRow key={song.id} song={song} onPress={() => router.push(`/songs/${song.id}`)} />
          ))}
        </View>
      )}

      <Dialog
        visible={facet !== null}
        onClose={() => setFacet(null)}
        title={t("songs.filterTitle")}
        description={t("songs.filterDescription")}
      >
        <View style={styles.facetTabs}>
          {(["artist", "genre", "key", "tag"] as FacetKey[]).map((key) => (
            <Chip
              key={key}
              label={t(FACET_LABELS[key])}
              tone="primary"
              selected={facet === key}
              onPress={() => setFacet(key)}
            />
          ))}
        </View>

        <View style={styles.facetOptions}>
          {facetOptions.length === 0 ? (
            <AppText variant="caption" tone="faint">
              {t("songs.noFacetOptions")}
            </AppText>
          ) : (
            facetOptions.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={facet ? filters[facet] === option : false}
                onPress={() => facet && setFacetValue(facet, option)}
              />
            ))
          )}
        </View>
      </Dialog>
    </ScreenContainer>
  )
}

/** Screen-reader friendly name of a facet key. */
const createStyles = () =>
  StyleSheet.create({
    toolbar: { gap: Theme.spacing.s },
    searchRow: { flexDirection: "row", alignItems: "flex-end", gap: Theme.spacing.s },
    search: { flex: 1 },
    activeFilters: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    list: { gap: Theme.spacing.m },
    facetTabs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    facetOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  })
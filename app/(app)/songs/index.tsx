import React, { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { IconButton } from "@/components/ui/Button"
import { Chip } from "@/components/ui/Card"
import { Input, SearchInput } from "@/components/ui/Input"
import { Dialog } from "@/components/ui/Dialog"
import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { FilterIcon, ImportIcon, PlusIcon, SaveIcon, SearchIcon, SortIcon, TrashIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { SongRow } from "@/components/app/SongRow"
import { useToast } from "@/components/ui/Toast"
import { useUserId } from "@/hooks/useAuth"
import { useFavorites } from "@/hooks/useFavorites"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { useSongbookState } from "@/hooks/useSongbookState"
import {
  BPM_BUCKETS,
  DURATION_BUCKETS,
  EMPTY_FILTERS,
  countActiveFilters,
  filterSongs,
  isFiltered,
  type BpmBucket,
  type DurationBucket,
} from "@/libs/songSearch"
import { SONG_SORTS, sortSongs, type SongSort } from "@/libs/songbookSort"
import { MAX_SONGBOOK_VIEWS } from "@/libs/songbookState"
import { SONG_USAGE_FILTERS, usagePassIds, type SongUsageFilter } from "@/libs/songUsage"
import type { SongFacets } from "@/interfaces"

type FacetKey = "artist" | "genre" | "key" | "tag"

const FACET_KEYS: FacetKey[] = ["artist", "genre", "key", "tag"]

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

/** Advanced-search buckets (roadmap #36), labelled where they are rendered. */
const BPM_LABELS: Record<BpmBucket, string> = {
  slow: "songs.bpmSlow",
  medium: "songs.bpmMedium",
  fast: "songs.bpmFast",
  sprint: "songs.bpmSprint",
}

const DURATION_LABELS: Record<DurationBucket, string> = {
  short: "songs.durationShort",
  standard: "songs.durationStandard",
  long: "songs.durationLong",
}

/** Usage chips (roadmap #34), derived from the band's completed events. */
const USAGE_LABELS: Record<SongUsageFilter, string> = {
  never: "songs.usageNever",
  notRecent: "songs.usageNotRecent",
}

/** Sort labels are i18n keys, resolved where they are rendered. */
const SORT_LABELS: Record<SongSort, string> = {
  title: "songs.sortTitle",
  titleDesc: "songs.sortTitleDesc",
  artist: "songs.sortArtist",
  added: "songs.sortAdded",
  tempo: "songs.sortTempo",
  length: "songs.sortLength",
}

/** Songbook with instant search, facets and chord-progression search (§33, §34, #36). */
export default function SongsScreen() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const toast = useToast()
  const router = useRouter()
  const { isAdmin, organizationId } = useOrganization()
  const uid = useUserId()
  const { songs, facets, loading, error, songUsage } = useOrgData()
  // Filters and order are remembered per band and per user (roadmap #37), so a
  // member's facets never follow them into another band's library.
  const { filters, setFilters, sort, setSort, views, saveView, applyView, deleteView } =
    useSongbookState(organizationId, uid)
  // Favorites are personal (roadmap #33): the set rides into filterSongs as
  // context, so the list and the active-filter count can never disagree about
  // what the star facet is showing.
  const { favoriteSet } = useFavorites()
  const [facet, setFacet] = useState<FacetKey | null>(null)
  const [sortOpen, setSortOpen] = useState(false)
  const [savingView, setSavingView] = useState(false)
  const [viewName, setViewName] = useState("")

  // Usage (roadmap #34) is the same contract as favorites: the derived
  // performance walk is resolved to the id set the filter keeps, once per
  // render, so filterSongs stays a pure pass over songs.
  const usagePass = useMemo(
    () => (filters.usage ? usagePassIds(songs, filters.usage, songUsage) : undefined),
    [songs, filters.usage, songUsage],
  )
  const results = useMemo(
    () => sortSongs(filterSongs(songs, filters, favoriteSet, usagePass), sort),
    [songs, filters, favoriteSet, usagePass, sort],
  )
  const activeCount = countActiveFilters(filters)
  const progression = filters.progression.trim()

  const setFacetValue = (key: FacetKey, value: string | null): void => {
    setFilters((current) => ({ ...current, [key]: current[key] === value ? null : value }))
  }

  const toggleBpm = (value: BpmBucket): void => {
    setFilters((current) => ({ ...current, bpm: current.bpm === value ? null : value }))
  }

  const toggleDuration = (value: DurationBucket): void => {
    setFilters((current) => ({ ...current, duration: current.duration === value ? null : value }))
  }

  const toggleUsage = (value: SongUsageFilter): void => {
    setFilters((current) => ({ ...current, usage: current.usage === value ? null : value }))
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
            {/* The filter is an icon button like the ones next to it: the row
                is tight on a phone, and the search field is what needs the
                width. The count of active filters lives in the button's label
                (and in the chips below). */}
            <IconButton
              label={
                activeCount > 0 ? t("songs.filtersCount", { count: activeCount }) : t("songs.filters")
              }
              variant="secondary"
              onPress={() => setFacet(facet ?? "key")}
              icon={
                <FilterIcon
                  size={16}
                  color={activeCount > 0 ? Theme.colors.primary : Theme.colors.text}
                />
              }
            />
            <IconButton
              label={t("songs.sortA11y", { order: t(SORT_LABELS[sort]) })}
              variant="secondary"
              onPress={() => setSortOpen(true)}
              icon={<SortIcon size={16} color={Theme.colors.text} />}
            />
            {isAdmin ? (
              <>
                <IconButton
                  label={t("backup.importTitle")}
                  variant="secondary"
                  onPress={() => router.push("/songs/import")}
                  icon={<ImportIcon size={16} color={Theme.colors.text} />}
                />
                <IconButton
                  label={t("songs.trash")}
                  variant="secondary"
                  onPress={() => router.push("/songs/trash")}
                  icon={<TrashIcon size={16} color={Theme.colors.text} />}
                />
              </>
            ) : null}
          </View>

          {activeCount > 0 ? (
            <View style={styles.activeFilters}>
              {FACET_KEYS.filter((key) => filters[key] !== null).map((key) => (
                <Chip
                  key={key}
                  label={`${t(FACET_LABELS[key])}: ${filters[key] ?? ""}`}
                  tone="primary"
                  size="sm"
                  onPress={() => setFacetValue(key, null)}
                  accessibilityLabel={t("songs.removeFilter", { filter: t(FACET_LABELS[key]) })}
                />
              ))}
              {filters.bpm !== null ? (
                <Chip
                  label={`${t("songs.bpm")}: ${t(BPM_LABELS[filters.bpm])}`}
                  tone="primary"
                  size="sm"
                  onPress={() => setFilters((current) => ({ ...current, bpm: null }))}
                  accessibilityLabel={t("songs.removeFilter", { filter: t("songs.bpm") })}
                />
              ) : null}
              {filters.duration !== null ? (
                <Chip
                  label={`${t("songs.duration")}: ${t(DURATION_LABELS[filters.duration])}`}
                  tone="primary"
                  size="sm"
                  onPress={() => setFilters((current) => ({ ...current, duration: null }))}
                  accessibilityLabel={t("songs.removeFilter", { filter: t("songs.duration") })}
                />
              ) : null}
              {filters.favoritesOnly ? (
                <Chip
                  label={t("songs.favoritesOnly")}
                  tone="primary"
                  size="sm"
                  onPress={() => setFilters((current) => ({ ...current, favoritesOnly: false }))}
                  accessibilityLabel={t("songs.removeFilter", { filter: t("songs.favoritesOnly") })}
                />
              ) : null}
              {filters.usage !== null ? (
                <Chip
                  label={t(USAGE_LABELS[filters.usage])}
                  tone="primary"
                  size="sm"
                  onPress={() => setFilters((current) => ({ ...current, usage: null }))}
                  accessibilityLabel={t("songs.removeFilter", { filter: t("songs.usage") })}
                />
              ) : null}
              {progression.length > 0 ? (
                <Chip
                  label={`${t("songs.chords")}: ${progression}`}
                  tone="primary"
                  size="sm"
                  onPress={() => setFilters((current) => ({ ...current, progression: "" }))}
                  accessibilityLabel={t("songs.removeFilter", { filter: t("songs.progression") })}
                />
              ) : null}
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

      <BottomSheet
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        title={t("songs.viewsSheetTitle")}
      >
        {views.map((view) => (
          <SheetOptionRow
            key={view.id}
            label={view.name}
            hint={t(SORT_LABELS[view.sort])}
            onPress={() => {
              applyView(view.id)
              setSortOpen(false)
            }}
            trailing={
              <IconButton
                label={t("songs.deleteView", { name: view.name })}
                size={32}
                onPress={() => deleteView(view.id)}
                icon={<TrashIcon size={16} color={Theme.colors.textMuted} />}
              />
            }
          />
        ))}
        {views.length === 0 ? (
          <AppText variant="caption" tone="faint">
            {t("songs.noViews")}
          </AppText>
        ) : null}
        <SheetOptionRow
          label={t("songs.saveCurrentView")}
          onPress={() => {
            setSortOpen(false)
            setSavingView(true)
          }}
          trailing={<SaveIcon size={18} color={Theme.colors.textMuted} />}
        />

        <AppText variant="caption" tone="muted" style={styles.orderLabel}>
          {t("songs.orderSection")}
        </AppText>
        {SONG_SORTS.map((option) => (
          <SheetOptionRow
            key={option}
            label={t(SORT_LABELS[option])}
            selected={sort === option}
            onPress={() => {
              setSort(option)
              setSortOpen(false)
            }}
          />
        ))}
      </BottomSheet>

      <Dialog
        visible={savingView}
        onClose={() => setSavingView(false)}
        title={t("songs.saveViewTitle")}
        description={views.length >= MAX_SONGBOOK_VIEWS ? t("songs.viewsLimitHint") : undefined}
        confirmLabel={t("common.save")}
        confirmDisabled={!viewName.trim()}
        onConfirm={() => {
          const name = viewName.trim()
          saveView(name)
          setSavingView(false)
          setViewName("")
          // Saving is instant and silent otherwise; the toast is the only proof
          // the view is there the next time the sheet is opened.
          toast.showSuccess(t("songs.viewSaved", { name }))
        }}
      >
        <Input
          label={t("songs.viewName")}
          placeholder={t("songs.viewNamePlaceholder")}
          value={viewName}
          onChangeText={setViewName}
          autoFocus
        />
      </Dialog>

      <Dialog
        visible={facet !== null}
        onClose={() => setFacet(null)}
        title={t("songs.filterTitle")}
        description={t("songs.filterDescription")}
      >
        <Input
          label={t("songs.progression")}
          hint={t("songs.progressionHint")}
          placeholder={t("songs.progressionPlaceholder")}
          value={filters.progression}
          onChangeText={(value) => setFilters((current) => ({ ...current, progression: value }))}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.facetTabs}>
          {FACET_KEYS.map((key) => (
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

        <View style={styles.facetGroup}>
          <AppText variant="label" tone="muted">
            {t("songs.bpm")}
          </AppText>
          <View style={styles.facetOptions}>
            {BPM_BUCKETS.map((bucket) => (
              <Chip
                key={bucket}
                label={t(BPM_LABELS[bucket])}
                selected={filters.bpm === bucket}
                onPress={() => toggleBpm(bucket)}
              />
            ))}
          </View>
        </View>

        <View style={styles.facetGroup}>
          <AppText variant="label" tone="muted">
            {t("songs.duration")}
          </AppText>
          <View style={styles.facetOptions}>
            {DURATION_BUCKETS.map((bucket) => (
              <Chip
                key={bucket}
                label={t(DURATION_LABELS[bucket])}
                selected={filters.duration === bucket}
                onPress={() => toggleDuration(bucket)}
              />
            ))}
          </View>
        </View>

        <View style={styles.facetGroup}>
          <AppText variant="label" tone="muted">
            {t("songs.favorites")}
          </AppText>
          <View style={styles.facetOptions}>
            <Chip
              label={t("songs.favoritesOnly")}
              selected={filters.favoritesOnly}
              onPress={() =>
                setFilters((current) => ({ ...current, favoritesOnly: !current.favoritesOnly }))
              }
            />
          </View>
        </View>

        <View style={styles.facetGroup}>
          <AppText variant="label" tone="muted">
            {t("songs.usage")}
          </AppText>
          <View style={styles.facetOptions}>
            {SONG_USAGE_FILTERS.map((option) => (
              <Chip
                key={option}
                label={t(USAGE_LABELS[option])}
                selected={filters.usage === option}
                onPress={() => toggleUsage(option)}
              />
            ))}
          </View>
        </View>
      </Dialog>
    </ScreenContainer>
  )
}

/** Layout of the toolbar, the filter dialog and the result list. */
const createStyles = () =>
  StyleSheet.create({
    toolbar: { gap: Theme.spacing.s },
    searchRow: { flexDirection: "row", alignItems: "flex-end", gap: Theme.spacing.s },
    search: { flex: 1 },
    activeFilters: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: Theme.spacing.xs },
    facetTabs: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.xs },
    facetOptions: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.xs },
    /** Separates the sheet's two sections: saved views, then the order list. */
    orderLabel: { marginTop: Theme.spacing.m },
    facetGroup: { gap: Theme.spacing.xs },
    list: { gap: Theme.spacing.m },
  })

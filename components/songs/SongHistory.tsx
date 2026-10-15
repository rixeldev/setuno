import React, { useCallback, useEffect, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import type { Song, SongInput, SongVersion } from "@/interfaces"
import { toDate } from "@/interfaces/timestamp"
import { formatRelativeTime } from "@/libs/format"
import { songVersionData, versionDiff } from "@/libs/songHistory"
import { fetchSong, updateSong } from "@/services/songs"
import { fetchVersions } from "@/services/songVersions"
import { toFriendlyError } from "@/services/errors"
import { ModalScreen } from "@/components/app/ModalScreen"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import { RestartIcon } from "@/components/ui/Icons"
import { SongVersionDiff } from "@/components/songs/SongVersionDiff"

interface SongHistoryProps {
  songId: string
  songTitle: string
}

interface HistoryState {
  loading: boolean
  error: boolean
  versions: SongVersion[]
  current: Song | null
}

/**
 * Version history of one song (roadmap #26): every admin save keeps the
 * state it replaced, and selecting one compares it with the song as it is
 * now — struck text is what the song lost, accent text what it gained. The
 * restore is a save like any other, so the state it replaces is versioned
 * first and the step back is itself undoable.
 */
export function SongHistory({ songId, songTitle }: SongHistoryProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const toast = useToast()
  const { organizationId, isAdmin } = useOrganization()
  const { profile } = useAuth()

  const [state, setState] = useState<HistoryState>({
    loading: true,
    error: false,
    versions: [],
    current: null,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const load = useCallback(async (): Promise<{
    versions: SongVersion[]
    current: Song | null
  }> => {
    if (!organizationId) return { versions: [], current: null }
    const [current, versions] = await Promise.all([
      fetchSong(organizationId, songId),
      fetchVersions(organizationId, songId),
    ])
    return { versions, current }
  }, [organizationId, songId])

  useEffect(() => {
    let cancelled = false
    load()
      .then(({ versions, current }) => {
        if (!cancelled) setState({ loading: false, error: false, versions, current })
      })
      .catch(() => {
        if (!cancelled) setState((previous) => ({ ...previous, loading: false, error: true }))
      })
    return () => {
      cancelled = true
    }
  }, [load])

  const reload = (): void => {
    setState((previous) => ({ ...previous, loading: true, error: false }))
    load()
      .then(({ versions, current }) => setState({ loading: false, error: false, versions, current }))
      .catch(() => setState((previous) => ({ ...previous, loading: false, error: true })))
  }

  const selected = state.versions.find((version) => version.id === selectedId) ?? null
  const selectedWhen = selected ? formatRelativeTime(toDate(selected.savedAt)) : ""
  // The song's current content, projected once: the diff of every expanded
  // row compares against this same value.
  const currentData: SongInput | null = state.current ? songVersionData(state.current) : null

  const restore = async (): Promise<void> => {
    if (!selected || !organizationId) return
    setRestoring(true)
    try {
      await updateSong(organizationId, songId, selected.data, {
        id: profile?.uid ?? "",
        name: profile?.displayName || "An admin",
      })
      const { versions, current } = await load()
      setState({ loading: false, error: false, versions, current })
      setSelectedId(null)
      setConfirming(false)
      toast.showSuccess(t("songs.historyRestored"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("songs.historyRestoreFailed")))
    } finally {
      setRestoring(false)
    }
  }

  return (
    <ModalScreen title={t("songs.history")} subtitle={songTitle || undefined}>
      <AppText variant="caption" tone="muted">
        {t("songs.historyHint")}
      </AppText>

      {state.loading ? <SkeletonList count={3} height={64} /> : null}

      {!state.loading && state.error ? (
        <ErrorState message={t("songs.historyLoadFailed")} onRetry={reload} compact />
      ) : null}

      {!state.loading && !state.error && state.versions.length === 0 ? (
        <EmptyState
          title={t("songs.historyEmpty")}
          message={t("songs.historyEmptyDescription")}
          compact
        />
      ) : null}

      {!state.loading && !state.error
        ? state.versions.map((version) => {
            const when = formatRelativeTime(toDate(version.savedAt))
            const isSelected = version.id === selectedId
            const diff = isSelected && currentData ? versionDiff(version.data, currentData) : null
            return (
              <View key={version.id} style={styles.row}>
                <Pressable
                  onPress={() => setSelectedId(isSelected ? null : version.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={t("songs.historyVersionA11y", {
                    name: version.savedByName,
                    when,
                  })}
                  style={({ pressed }) => [
                    styles.versionRow,
                    isSelected && styles.versionRowSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.versionText}>
                    <AppText variant="body" numberOfLines={1}>
                      {version.savedByName}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {when}
                    </AppText>
                  </View>
                </Pressable>

                {diff && currentData ? (
                  <Card padded style={styles.diffCard}>
                    <SongVersionDiff diff={diff} before={version.data} after={currentData} />
                    {isAdmin ? (
                      <Button
                        label={t("songs.historyRestore")}
                        variant="secondary"
                        icon={<RestartIcon size={16} color={Theme.colors.text} />}
                        onPress={() => setConfirming(true)}
                      />
                    ) : null}
                  </Card>
                ) : null}
              </View>
            )
          })
        : null}

      <Dialog
        visible={confirming}
        onClose={() => setConfirming(false)}
        title={t("songs.historyRestoreConfirmTitle", { when: selectedWhen })}
        description={t("songs.historyRestoreConfirmBody")}
        confirmLabel={t("songs.historyRestore")}
        onConfirm={() => void restore()}
        confirmLoading={restoring}
        tone="danger"
      />
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    row: { gap: Theme.spacing.s },
    versionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      padding: Theme.spacing.m,
      borderRadius: Theme.radii.m,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.surface,
    },
    versionRowSelected: {
      borderColor: Theme.colors.accent,
      backgroundColor: Theme.colors.accentSoft,
    },
    versionText: { flex: 1, gap: 2, minWidth: 0 },
    pressed: { opacity: 0.75 },
    diffCard: { gap: Theme.spacing.m },
  })

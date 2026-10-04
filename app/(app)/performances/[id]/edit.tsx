import React, { useMemo } from "react"
import { StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { PerformanceForm } from "@/components/performances/PerformanceForm"
import { EmptyState, Skeleton } from "@/components/ui/States"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useOrgData } from "@/hooks/useOrgData"

/** Edit an existing show. */
export default function EditPerformance() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const params = useLocalSearchParams<{ id?: string }>()
  const { performances, loading } = useOrgData()

  const performance = useMemo(
    () => performances.find((entry) => entry.id === params.id) ?? null,
    [performances, params.id],
  )

  if (loading && !performance) {
    return (
      <View style={styles.host}>
        <Skeleton height={30} width="50%" />
        <Skeleton height={240} />
      </View>
    )
  }

  if (!performance) {
    return (
      <View style={styles.host}>
        <EmptyState
          title="Show not found"
          message="It may have been deleted while you were editing."
          actionLabel="Back to shows"
          onAction={() => router.replace("/performances")}
        />
      </View>
    )
  }

  return <PerformanceForm performance={performance} onSaved={() => router.back()} />
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1, backgroundColor: Theme.colors.background, padding: Theme.spacing.l, gap: Theme.spacing.l },
  })
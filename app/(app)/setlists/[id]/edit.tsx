import React, { useMemo } from "react"
import { StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { SetlistForm } from "@/components/setlists/SetlistForm"
import { EmptyState, Skeleton } from "@/components/ui/States"
import { useOrgData } from "@/hooks/useOrgData"

/** Edit a setlist's details without leaving the running order behind. */
export default function EditSetlist() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const params = useLocalSearchParams<{ id?: string }>()
  const setlistId = params.id ?? null
  const { setlists, loading } = useOrgData()

  const setlist = useMemo(
    () => setlists.find((entry) => entry.id === setlistId) ?? null,
    [setlists, setlistId],
  )

  if (loading && !setlist) {
    return (
      <View style={styles.host}>
        <Skeleton height={30} width="50%" />
        <Skeleton height={220} />
      </View>
    )
  }

  if (!setlist) {
    return (
      <View style={styles.host}>
        <EmptyState
          title="Setlist not found"
          message="It may have been deleted while you were editing."
          actionLabel="Back to setlists"
          onAction={() => router.replace("/setlists")}
        />
      </View>
    )
  }

  return <SetlistForm setlist={setlist} onSaved={() => router.replace(`/setlists/${setlist.id}`)} />
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1, backgroundColor: Theme.colors.background, padding: Theme.spacing.l, gap: Theme.spacing.l },
  })
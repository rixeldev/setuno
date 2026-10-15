import React, { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { SetlistForm } from "@/components/setlists/SetlistForm"
import { ModalScreen } from "@/components/app/ModalScreen"
import { useAuth } from "@/hooks/useAuth"
import { fetchCollection } from "@/services/collections"

interface Draft {
  name: string
  songIds: string[]
}

/**
 * Create a new setlist (admin only). Opened with `?fromCollection=<id>` it
 * first resolves that private collection (roadmap #33) and hands its name and
 * songs to the form as a draft — the form passes them straight into
 * `createSetlist`, which builds the entries. The collection itself is never
 * touched: the setlist it seeds is a shared document, the draft stays private.
 */
export default function NewSetlist() {
  const router = useRouter()
  const { t } = useTranslation()
  const { fromCollection } = useLocalSearchParams<{ fromCollection?: string }>()
  const { profile } = useAuth()
  const uid = profile?.uid ?? null
  const [draft, setDraft] = useState<Draft | null>(null)
  const [resolved, setResolved] = useState(fromCollection === undefined)

  useEffect(() => {
    if (fromCollection === undefined || uid === null) return
    let cancelled = false
    void fetchCollection(uid, fromCollection)
      .then((collection) => {
        if (cancelled || collection === null) return
        setDraft({ name: collection.name, songIds: collection.songIds })
      })
      // A collection that vanished (or cannot be read) simply opens the plain
      // empty form — the editor must not dead-end on a stale deep link.
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setResolved(true)
      })
    return () => {
      cancelled = true
    }
  }, [fromCollection, uid])

  if (!resolved) {
    return (
      <ModalScreen title={t("setlists.newSetlist")}>
        <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.loading} />
      </ModalScreen>
    )
  }

  return (
    <SetlistForm
      draftName={draft?.name}
      draftSongIds={draft?.songIds}
      onSaved={(id) => router.replace(`/setlists/${id}`)}
    />
  )
}

const styles = StyleSheet.create({
  loading: { marginTop: Theme.spacing.xl, alignSelf: "center" },
})

import React, { useMemo } from "react"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { SetlistForm } from "@/components/setlists/SetlistForm"
import { ModalScreen } from "@/components/app/ModalScreen"
import { EmptyState, Skeleton } from "@/components/ui/States"
import { useOrgData } from "@/hooks/useOrgData"

/** Edit a setlist's details without leaving the running order behind, as a modal. */
export default function EditSetlist() {
  const { t } = useTranslation()
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
      <ModalScreen title={t("setlists.editSetlist")}>
        <Skeleton height={30} width="50%" />
        <Skeleton height={220} />
      </ModalScreen>
    )
  }

  if (!setlist) {
    return (
      <ModalScreen title={t("setlists.editSetlist")}>
        <EmptyState
          title={t("setlists.setlistNotFound")}
          message={t("setlists.notFoundEditing")}
          actionLabel={t("setlists.backToSetlists")}
          onAction={() => router.replace("/setlists")}
        />
      </ModalScreen>
    )
  }

  return <SetlistForm setlist={setlist} onSaved={() => router.replace(`/setlists/${setlist.id}`)} />
}

import React, { useMemo } from "react"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { PerformanceForm } from "@/components/performances/PerformanceForm"
import { ModalScreen } from "@/components/app/ModalScreen"
import { EmptyState, Skeleton } from "@/components/ui/States"
import { useOrgData } from "@/hooks/useOrgData"

/** Edit an existing show, presented as a modal. */
export default function EditPerformance() {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useLocalSearchParams<{ id?: string }>()
  const { performances, loading } = useOrgData()

  const performance = useMemo(
    () => performances.find((entry) => entry.id === params.id) ?? null,
    [performances, params.id],
  )

  if (loading && !performance) {
    return (
      <ModalScreen title={t("performances.editPerformance")}>
        <Skeleton height={30} width="50%" />
        <Skeleton height={240} />
      </ModalScreen>
    )
  }

  if (!performance) {
    return (
      <ModalScreen title={t("performances.editPerformance")}>
        <EmptyState
          title={t("performances.performanceNotFound")}
          message={t("performances.notFoundEditing")}
          actionLabel={t("performances.backToPerformances")}
          onAction={() => router.replace("/performances")}
        />
      </ModalScreen>
    )
  }

  return <PerformanceForm performance={performance} onSaved={() => router.back()} />
}

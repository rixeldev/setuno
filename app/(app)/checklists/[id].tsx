import React from "react"
import { useLocalSearchParams } from "expo-router"
import { useTranslation } from "react-i18next"

import { ChecklistForm } from "@/components/checklists/ChecklistForm"
import { ErrorState, Skeleton } from "@/components/ui/States"
import { useChecklist } from "@/hooks/useChecklists"
import { useOrganization } from "@/hooks/useOrganization"

/**
 * Edit a band checklist (roadmap #49). The form only mounts once the
 * subscription delivers the template, so its fields seed once at mount —
 * the PerformanceForm pattern exactly — and a deleted id falls back to an
 * error state instead of an empty draft.
 */
export default function EditChecklist() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { organizationId } = useOrganization()
  const { list, loading, error } = useChecklist(organizationId, id ?? null)

  if (error && !list) return <ErrorState message={error} />
  if (!list) {
    return loading ? (
      <Skeleton height={280} />
    ) : (
      <ErrorState message={t("checklists.gone")} />
    )
  }

  return <ChecklistForm key={list.id} template={list} />
}

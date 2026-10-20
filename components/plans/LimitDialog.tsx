import React from "react"
import { router } from "expo-router"
import { useTranslation } from "react-i18next"

import { Dialog } from "@/components/ui/Dialog"

/**
 * The upsell shown when a free member runs into one of the free plan's limits
 * (roadmap #63).
 *
 * The limit is **communicated before it is hit** (the plan screen always says
 * what the free plan allows) and this is the moment it is hit: the dialog
 * explains the limit and points at the plan, rather than failing with an
 * error the member cannot act on.
 */
export function LimitDialog({
  visible,
  message,
  onClose,
}: {
  visible: boolean
  /** The sentence explaining which limit was reached. */
  message: string
  onClose: () => void
}) {
  const { t } = useTranslation()

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={t("plan.limitTitle")}
      description={message}
      confirmLabel={t("plan.seePlan")}
      onConfirm={() => {
        onClose()
        router.push("/settings/plan")
      }}
    />
  )
}

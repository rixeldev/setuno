import React, { useState } from "react"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { ModalScreen } from "@/components/app/ModalScreen"
import { useToast } from "@/components/ui/Toast"
import { usePlanPurchase } from "@/hooks/usePlanPurchase"

/**
 * A small tip for the person who made the app (roadmap #64).
 *
 * It is a **consumable** and it **grants nothing**: no feature, no limit, no
 * badge. The server confirms the purchase, consumes it (so it can be tipped
 * again) and records that it happened — and it does not touch the plan of a
 * member who already has one.
 *
 * There is **no external payment link** anywhere here: the tip goes through
 * the store the app already uses.
 */
export default function SupportScreen() {
  const { t } = useTranslation()
  const toast = useToast()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const store = usePlanPurchase({
    // A tip belongs to the person, not to the band.
    organizationId: "",
    onPurchased: () => {
      toast.showSuccess(t("plan.tipThanks"))
      router.back()
    },
    onError: (code) => {
      toast.showError(
        code === "store-unavailable" ? t("plan.storeUnavailable") : t("plan.purchaseFailed"),
      )
    },
  })

  const onTip = async (): Promise<void> => {
    setBusy(true)
    try {
      await store.tipNow()
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalScreen title={t("plan.supportTitle")} subtitle={t("plan.supportSubtitle")}>
      <Card>
        <AppText variant="body" tone="muted">
          {t("plan.supportExplains")}
        </AppText>
        {store.tip ? (
          <AppText variant="bodyStrong">{store.tip.price}</AppText>
        ) : null}
      </Card>

      <Button
        label={t("plan.tipNow", { price: store.tip?.price ?? "" })}
        full
        loading={busy}
        disabled={!store.tip}
        onPress={() => void onTip()}
      />
    </ModalScreen>
  )
}

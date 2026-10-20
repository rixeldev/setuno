import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { ModalScreen } from "@/components/app/ModalScreen"
import { useToast } from "@/components/ui/Toast"
import { useEntitlement } from "@/hooks/useEntitlement"
import { usePlanPurchase } from "@/hooks/usePlanPurchase"
import { PRO_PRODUCTS } from "@/functions/src/entitlements"
import { fetchEntitlement, syncPurchase } from "@/services/entitlements"
import { toFriendlyError } from "@/services/errors"

/**
 * The member's plan (roadmap #61, with the restore flow of #62).
 *
 * The screen never decides what the member is entitled to: the entitlement
 * lives on the server and the "restore" button simply asks it again. The
 * purchase itself is confirmed by the store and written by the callable.
 */
export default function PlanScreen() {
  const { t } = useTranslation()
  const toast = useToast()
  const plan = useEntitlement()
  const [busy, setBusy] = useState(false)

  const store = usePlanPurchase({
    onPurchased: () => {
      toast.showSuccess(t("plan.proActivated"))
    },
    onError: (code) => {
      toast.showError(
        code === "store-unavailable" ? t("plan.storeUnavailable") : t("plan.purchaseFailed"),
      )
    },
  })

  const onBuy = async (productId: string): Promise<void> => {
    setBusy(true)
    try {
      await store.buy(productId)
    } finally {
      setBusy(false)
    }
  }

  const onRestore = async (): Promise<void> => {
    setBusy(true)
    try {
      const purchases = await store.restore()
      for (const purchase of purchases) {
        await syncPurchase(purchase.productId, purchase.purchaseToken)
      }
      await fetchEntitlement()
      toast.showSuccess(purchases.length > 0 ? t("plan.restored") : t("plan.nothingToRestore"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("plan.restoreFailed")))
    } finally {
      setBusy(false)
    }
  }

  const monthly = store.products.find((product) => product.id === PRO_PRODUCTS.monthly)
  const annual = store.products.find((product) => product.id === PRO_PRODUCTS.annual)

  return (
    <ModalScreen title={t("plan.title")} subtitle={t("plan.subtitle")}>
      <Card>
        <AppText variant="heading">{plan.isPro ? t("plan.pro") : t("plan.free")}</AppText>
        <AppText variant="body" tone="muted">
          {plan.isPro ? t("plan.proHint") : t("plan.freeHint")}
        </AppText>
        {plan.isPro && plan.expiresAt ? (
          <AppText variant="caption" tone="muted">
            {t("plan.until", { date: plan.expiresAt })}
          </AppText>
        ) : null}
        {plan.limits ? (
          <AppText variant="caption" tone="muted">
            {t("plan.limits", { bands: plan.limits.bands, songs: plan.limits.songs })}
          </AppText>
        ) : null}
      </Card>

      <Card>
        <AppText variant="label" tone="faint">
          {t("plan.perksTitle")}
        </AppText>
        <AppText variant="body" tone="muted">
          {t("plan.perkNoAds")}
        </AppText>
        <AppText variant="body" tone="muted">
          {t("plan.perkStats")}
        </AppText>
        <AppText variant="body" tone="muted">
          {t("plan.perkBands")}
        </AppText>
      </Card>

      {monthly || annual ? (
        <Card>
          <AppText variant="label" tone="faint">
            {t("plan.buyTitle")}
          </AppText>
          {monthly ? (
            <Button
              label={t("plan.buyMonthly", { price: monthly.price })}
              full
              loading={busy}
              onPress={() => void onBuy(PRO_PRODUCTS.monthly)}
            />
          ) : null}
          {annual ? (
            <Button
              label={t("plan.buyAnnual", { price: annual.price })}
              full
              variant="secondary"
              loading={busy}
              onPress={() => void onBuy(PRO_PRODUCTS.annual)}
            />
          ) : null}
        </Card>
      ) : (
        <Card>
          <AppText variant="body" tone="muted">
            {t("plan.notOffered")}
          </AppText>
        </Card>
      )}

      <Button
        label={t("plan.restore")}
        variant="secondary"
        full
        loading={busy}
        onPress={() => void onRestore()}
      />
      {plan.isPro ? (
        <Button
          label={t("plan.manage")}
          variant="ghost"
          full
          onPress={() => void store.manage()}
        />
      ) : null}
    </ModalScreen>
  )
}

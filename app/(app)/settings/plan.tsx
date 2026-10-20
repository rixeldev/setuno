import React, { useState } from "react"
import { Linking, Platform, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { ModalScreen } from "@/components/app/ModalScreen"
import { useToast } from "@/components/ui/Toast"
import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useEntitlement } from "@/hooks/useEntitlement"
import { usePlanPurchase } from "@/hooks/usePlanPurchase"
import { useOrganization } from "@/hooks/useOrganization"
import { PRO_PRODUCTS } from "@/functions/src/entitlements"
import { fetchEntitlement, syncPurchase } from "@/services/entitlements"
import { toFriendlyError } from "@/services/errors"

/**
 * Where the Android build is downloaded from.
 *
 * The web build cannot sell the plan yet (the store's company details are
 * still being set up), so it points at the app instead — and the plan follows
 * the **account**, so buying it on Android turns the web into Pro too.
 */
const ANDROID_DOWNLOAD_URL = "https://play.google.com/store/apps/details?id=com.rixeldev.setuno"

/**
 * The member's plan (roadmap #61, with the restore flow of #62).
 *
 * The screen never decides what the member is entitled to: the entitlement
 * lives on the server and the "restore" button simply asks it again. The
 * purchase itself is confirmed by the store and written by the callable.
 */
export default function PlanScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const toast = useToast()
  const plan = useEntitlement()
  const { organizationId, isAdmin } = useOrganization()
  const [busy, setBusy] = useState(false)
  // The web cannot take the payment yet, so it says where to.
  const isWeb = Platform.OS === "web"
  // The plan belongs to the band, so only one of its admins can buy it.
  const canBuy = isAdmin && Boolean(organizationId)

  const store = usePlanPurchase({
    organizationId: organizationId ?? "",
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
        await syncPurchase(
          organizationId ?? "",
          purchase.productId,
          purchase.purchaseToken,
        )
      }
      await fetchEntitlement(organizationId ?? "")
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
          <AppText variant="label" tone="faint" style={styles.buyTitle}>
            {t("plan.buyTitle")}
          </AppText>
          {isWeb ? (
            <AppText variant="body" tone="muted">
              {t("plan.subscriptionsOnMobile")}
            </AppText>
          ) : null}
          <View style={styles.buyButtons}>
            {monthly ? (
              <Button
                label={t("plan.buyMonthly", { price: monthly.price })}
                full
                disabled={isWeb || !canBuy}
                loading={busy}
                onPress={() => void onBuy(PRO_PRODUCTS.monthly)}
              />
            ) : null}
            {annual ? (
              <Button
                label={t("plan.buyAnnual", { price: annual.price })}
                full
                variant="secondary"
                disabled={isWeb || !canBuy}
                loading={busy}
                onPress={() => void onBuy(PRO_PRODUCTS.annual)}
              />
            ) : null}
          </View>
          {isWeb ? (
            <Button
              label={t("plan.downloadAndroid")}
              variant="secondary"
              full
              onPress={() => void Linking.openURL(ANDROID_DOWNLOAD_URL)}
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

const createStyles = () =>
  StyleSheet.create({
    buyTitle: { marginBottom: Theme.spacing.xs },
    buyButtons: { gap: Theme.spacing.s },
  })

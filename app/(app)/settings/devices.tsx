import { Fragment, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Badge, Card, Divider } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { DevicesIcon } from "@/components/ui/Icons"
import { useToast } from "@/components/ui/Toast"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { useMyDevices } from "@/hooks/useMyDevices"
import { lastSeenLabel, platformLabel } from "@/libs/deviceSessions"
import { toFriendlyError } from "@/services/errors"

/**
 * Devices & sessions (roadmap #69): the phones and tablets registered to this
 * account (#52's push documents, read back owner-only), each with its last
 * seen time and this install's row marked — plus "sign out everywhere", which
 * revokes **every** refresh token for the account through one callable and
 * then leaves this session too, because the revocation is account-wide by
 * nature.
 *
 * The honest slice: Firebase exposes no browser sessions, so the list says
 * so instead of pretending to be a full session manager.
 */
export default function DevicesSettingsScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const toast = useToast()
  const { signOut } = useAuth()
  const { devices, failed, currentToken, now, retry, signOutEverywhere } = useMyDevices()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleSignOutEverywhere = async () => {
    if (busy) return
    setBusy(true)
    try {
      await signOutEverywhere()
      // The callable revoked this session's refresh token along with the
      // others — signing out locally is the same decision, taken cleanly.
      await signOut()
      toast.showSuccess(t("devices.signedOutToast"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("devices.signOutFailed")))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <ScreenContainer
      title={t("settings.devices")}
      subtitle={t("devices.subtitle")}
      back
    >
      <Card style={styles.card}>
        {failed ? (
          <View style={styles.column}>
            <AppText variant="caption" tone="muted">
              {t("devices.loadFailed")}
            </AppText>
            <Button
              variant="secondary"
              size="sm"
              label={t("common.retry")}
              onPress={retry}
            />
          </View>
        ) : devices === null ? (
          <AppText variant="caption" tone="muted">
            {t("common.loading")}
          </AppText>
        ) : devices.length === 0 ? (
          <AppText variant="caption" tone="muted">
            {t("devices.empty")}
          </AppText>
        ) : (
          <>
            {devices.map((device, index) => {
              const isCurrent = currentToken !== null && device.token === currentToken
              const seen = lastSeenLabel(t, device.lastSeenAt, now)
              return (
                <Fragment key={device.token}>
                  {index > 0 ? <Divider /> : null}
                  <View style={styles.row}>
                    <View style={styles.rowIcon}>
                      <DevicesIcon size={20} color={Theme.colors.primary} />
                    </View>
                    <View style={styles.rowBody}>
                      <View style={styles.rowTitle}>
                        <AppText variant="bodyStrong">
                          {platformLabel(t, device.platform)}
                        </AppText>
                        {isCurrent ? (
                          <Badge label={t("devices.thisDevice")} tone="primary" />
                        ) : null}
                      </View>
                      <AppText variant="caption" tone="muted">
                        {seen === null
                          ? t("devices.unknownLastSeen")
                          : t("devices.lastSeen", { when: seen })}
                      </AppText>
                    </View>
                  </View>
                </Fragment>
              )
            })}
            <AppText variant="caption" tone="faint" style={styles.note}>
              {t("devices.browserNote")}
            </AppText>
          </>
        )}
      </Card>

      <Card style={styles.card}>
        <AppText variant="caption" tone="muted">
          {t("devices.signOutDescription")}
        </AppText>
        <Button
          variant="danger"
          label={t("devices.signOutEverywhere")}
          onPress={() => setConfirming(true)}
        />
      </Card>

      <Dialog
        visible={confirming}
        onClose={() => setConfirming(false)}
        title={t("devices.signOutConfirm")}
        description={t("devices.signOutDescription")}
        cancelLabel={t("common.cancel")}
        confirmLabel={t("devices.signOutEverywhere")}
        tone="danger"
        confirmLoading={busy}
        onConfirm={() => void handleSignOutEverywhere()}
      />
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      gap: Theme.spacing.s,
    },
    column: {
      gap: Theme.spacing.s,
      alignItems: "flex-start",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.xs,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: Theme.radii.m,
      backgroundColor: Theme.colors.surface,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    rowBody: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      flexWrap: "wrap",
    },
    note: {
      marginTop: Theme.spacing.xs,
    },
  })

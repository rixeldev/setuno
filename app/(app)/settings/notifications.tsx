import { Fragment, useCallback, useState } from "react"
import { Linking, StyleSheet, Switch, View } from "react-native"
import { useFocusEffect } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card, Divider } from "@/components/ui/Card"
import { useToast } from "@/components/ui/Toast"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { matchLanguage } from "@/libs/language"
import { toFriendlyError } from "@/services/errors"
import { updatePreferences } from "@/services/users"
import { PUSH_NOTIFICATION_TYPES, type PushNotificationType } from "@/functions/src/notify"
import {
  disablePushForThisDevice,
  enablePushForThisDevice,
  getPushDeviceState,
  type PushDeviceState,
} from "@/services/notifications"

/**
 * Push notification preferences (roadmap #52): the OS permission state and
 * the per-device master switch (turning it off deletes this install's device
 * document — the absence *is* the off state, so the silent refresh on app
 * start can never turn it back on), plus the per-account opt-outs that
 * follow the user to every device. The device state is one local read; the
 * preferences ride the subscribed profile and write through
 * `updatePreferences`.
 */
export default function NotificationsSettingsScreen() {
  const { t, i18n } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const toast = useToast()
  const { user, profile } = useAuth()
  const uid = user?.uid ?? null
  const [deviceState, setDeviceState] = useState<PushDeviceState | null>(null)
  const [busy, setBusy] = useState(false)

  // The state is read every time the screen comes into focus, not only when it
  // mounts: the app-start question (roadmap #52) may have registered this
  // install, and the master switch has to show that.
  useFocusEffect(
    useCallback(() => {
      if (!uid) return
      let alive = true
      void getPushDeviceState(uid)
        .then((state) => {
          if (alive) setDeviceState(state)
        })
        .catch(() => {
          // A state read never carries information the user asked for: fall
          // back to the "not set up yet" wording and let the switch ask.
          if (alive) setDeviceState({ permission: "undetermined", registered: false })
        })
      return () => {
        alive = false
      }
    }, [uid]),
  )

  const notificationsPref = profile?.preferences?.notifications ?? {}

  const typeCopy: Record<PushNotificationType, { label: string; hint: string }> = {
    suggestionCreated: {
      label: t("settings.notifySuggestionCreated"),
      hint: t("settings.notifySuggestionCreatedHint"),
    },
    suggestionResolved: {
      label: t("settings.notifySuggestionResolved"),
      hint: t("settings.notifySuggestionResolvedHint"),
    },
    commentMentioned: {
      label: t("settings.notifyCommentMentioned"),
      hint: t("settings.notifyCommentMentionedHint"),
    },
    suggestionAssigned: {
      label: t("settings.notifySuggestionAssigned"),
      hint: t("settings.notifySuggestionAssignedHint"),
    },
    performanceCreated: {
      label: t("settings.notifyPerformanceCreated"),
      hint: t("settings.notifyPerformanceCreatedHint"),
    },
    invitationReceived: {
      label: t("settings.notifyInvitationReceived"),
      hint: t("settings.notifyInvitationReceivedHint"),
    },
    membershipChanged: {
      label: t("settings.notifyMembershipChanged"),
      hint: t("settings.notifyMembershipChangedHint"),
    },
  }

  const permissionCaption =
    deviceState === null || deviceState.permission === "unavailable"
      ? ""
      : deviceState.permission === "granted"
        ? t("settings.notificationsAllowed")
        : deviceState.permission === "denied"
          ? t("settings.notificationsBlocked")
          : t("settings.notificationsUndetermined")
  const permissionTone =
    deviceState?.permission === "granted"
      ? "success"
      : deviceState?.permission === "denied"
        ? "danger"
        : "muted"

  const setRegistered = async (next: boolean) => {
    if (!uid || busy) return
    setBusy(true)
    try {
      if (next) {
        const state = await enablePushForThisDevice(uid, matchLanguage(i18n.language))
        setDeviceState(state)
        if (state.registered) {
          toast.showSuccess(t("settings.notificationsEnabled"))
        } else if (state.permission === "denied") {
          toast.showError(t("settings.notificationsBlockedToast"))
        }
      } else {
        await disablePushForThisDevice(uid)
        setDeviceState((current) => (current ? { ...current, registered: false } : current))
      }
    } catch (error) {
      toast.showError(toFriendlyError(error, t("settings.notificationsDeviceFailed")))
    } finally {
      setBusy(false)
    }
  }

  const toggleType = async (type: PushNotificationType, next: boolean) => {
    if (!uid) return
    try {
      // The map is written whole: `updatePreferences` merges at the top level
      // only, so every other type's switch has to ride along explicitly.
      await updatePreferences(uid, {
        notifications: { ...notificationsPref, [type]: next },
      })
    } catch (error) {
      toast.showError(toFriendlyError(error, t("settings.notificationsSaveFailed")))
    }
  }

  const openSystemSettings = () => {
    void Linking.openSettings().catch(() => undefined)
  }

  return (
    <ScreenContainer
      title={t("settings.notifications")}
      subtitle={t("settings.notificationsScreenHint")}
      back
    >
      <Card style={styles.card}>
        {!uid || deviceState === null ? (
          <AppText variant="caption" tone="muted">
            {t("common.loading")}
          </AppText>
        ) : deviceState.permission === "unavailable" ? (
          <View style={styles.column}>
            <AppText variant="bodyStrong">{t("settings.notificationsMaster")}</AppText>
            <AppText variant="caption" tone="muted">
              {t("settings.notificationsWeb")}
            </AppText>
          </View>
        ) : (
          <>
            <View style={styles.row}>
              <View style={styles.column}>
                <AppText variant="bodyStrong">{t("settings.notificationsMaster")}</AppText>
                <AppText variant="caption" tone={permissionTone}>
                  {permissionCaption}
                </AppText>
              </View>
              <Switch
                accessibilityLabel={t("settings.notificationsMaster")}
                disabled={busy}
                value={deviceState.registered}
                onValueChange={(next) => void setRegistered(next)}
                trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
                ios_backgroundColor={Theme.colors.border}
              />
            </View>
            {deviceState.permission === "denied" ? (
              <Button
                label={t("settings.notificationsOpenSettings")}
                variant="secondary"
                size="sm"
                style={styles.action}
                onPress={openSystemSettings}
              />
            ) : null}
          </>
        )}
      </Card>

      <Card style={styles.card}>
        <View style={styles.column}>
          <AppText variant="bodyStrong">{t("settings.notificationsTypes")}</AppText>
          <AppText variant="caption" tone="muted">
            {t("settings.notificationsTypesHint")}
          </AppText>
        </View>
        {!profile ? (
          <AppText variant="caption" tone="muted">
            {t("common.loading")}
          </AppText>
        ) : (
          <>
            <Divider />
            {PUSH_NOTIFICATION_TYPES.map((type, index) => (
              <Fragment key={type}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.row}>
                  <View style={styles.column}>
                    <AppText variant="body">{typeCopy[type].label}</AppText>
                    <AppText variant="caption" tone="muted">
                      {typeCopy[type].hint}
                    </AppText>
                  </View>
                  <Switch
                    accessibilityLabel={typeCopy[type].label}
                    accessibilityHint={typeCopy[type].hint}
                    value={notificationsPref[type] !== false}
                    onValueChange={(next) => void toggleType(type, next)}
                    trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
                    ios_backgroundColor={Theme.colors.border}
                  />
                </View>
              </Fragment>
            ))}
          </>
        )}
      </Card>
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      marginBottom: Theme.spacing.xs,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.xxs,
    },
    column: {
      flex: 1,
      gap: 2,
    },
    action: {
      alignSelf: "flex-start",
      marginTop: Theme.spacing.xs,
    },
  })

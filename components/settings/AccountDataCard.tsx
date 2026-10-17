import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { useToast } from "@/components/ui/Toast"
import {
  deleteAccount,
  reauthMethod,
  reauthenticateWithPassword,
  requestAccountExport,
  saveAccountExport,
} from "@/services/accountData"
import { signOut } from "@/services/auth"
import { toFriendlyError } from "@/services/errors"
import { reauthenticateWithGoogle } from "@/services/googleAuth"

/**
 * The profile screen's "your data" block (roadmap #68): export everything the
 * account owns as one JSON file — share sheet on native, browser download on
 * web, through the seam the song export already uses — and delete the account
 * behind a re-authenticated danger dialog. The deletion itself is the
 * `deleteMyAccount` callable: the server walks the user out of every band,
 * wipes `users/{uid}` and removes the Auth user, so this card only owns the
 * confirmation flow and the local sign-out that follows it.
 */
export function AccountDataCard() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const toast = useToast()
  const method = reauthMethod()

  const [exporting, setExporting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [password, setPassword] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const exportData = async (): Promise<void> => {
    setExporting(true)
    try {
      const file = await requestAccountExport()
      const shared = await saveAccountExport(file, t("settings.exportData"))
      if (shared) toast.showSuccess(t("settings.exportDataDone"))
      else toast.showError(t("settings.exportDataUnavailable"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("settings.exportDataFailed")))
    } finally {
      setExporting(false)
    }
  }

  const closeConfirm = (): void => {
    if (deleting) return
    setConfirming(false)
    setFormError(null)
    setPassword("")
  }

  const confirmDelete = async (): Promise<void> => {
    setFormError(null)
    setDeleting(true)
    try {
      if (method === "password") {
        await reauthenticateWithPassword(password)
      } else if (method === "google") {
        const proved = await reauthenticateWithGoogle()
        // Backing out of the account picker is not a failure: the dialog
        // simply stays open, untouched.
        if (!proved) return
      }
      await deleteAccount()
      setConfirming(false)
      // Local session only — the Auth user is already gone on the server. The
      // auth listener routes to the sign-in screen afterwards, exactly like
      // signing out does.
      await signOut().catch(() => undefined)
    } catch (error) {
      setFormError(toFriendlyError(error, t("settings.deleteAccountFailed")))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card style={styles.card}>
      <AppText variant="heading">{t("settings.yourData")}</AppText>
      <AppText variant="body" tone="muted">
        {t("settings.yourDataHint")}
      </AppText>
      <Button
        label={t("settings.exportData")}
        variant="secondary"
        loading={exporting}
        disabled={deleting}
        onPress={() => void exportData()}
      />
      <Button
        label={t("settings.deleteAccount")}
        variant="danger"
        disabled={exporting}
        onPress={() => setConfirming(true)}
      />

      <Dialog
        visible={confirming}
        onClose={closeConfirm}
        title={t("settings.deleteAccountTitle")}
        description={t("settings.deleteAccountDescription")}
        tone="danger"
        confirmLabel={t("settings.deleteAccountConfirm")}
        confirmLoading={deleting}
        dismissible={!deleting}
        onConfirm={() => void confirmDelete()}
      >
        {method === "password" ? (
          <Input
            label={t("settings.deleteAccountPassword")}
            secure
            value={password}
            onChangeText={setPassword}
            error={formError}
            autoComplete="password"
            textContentType="password"
          />
        ) : (
          <View style={styles.dialogBody}>
            {method === "google" ? (
              <AppText variant="body" tone="muted">
                {t("settings.deleteAccountGoogleHint")}
              </AppText>
            ) : null}
            {formError ? (
              <AppText variant="body" tone="danger">
                {formError}
              </AppText>
            ) : null}
          </View>
        )}
      </Dialog>
    </Card>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.s },
    dialogBody: { gap: Theme.spacing.xs },
  })

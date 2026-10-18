import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Badge, Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { Input, SearchInput } from "@/components/ui/Input"
import { EmptyState } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import { SearchIcon } from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { useAuth } from "@/hooks/useAuth"
import { useMyJoinRequests } from "@/hooks/useJoinRequests"
import {
  createJoinRequest,
  deleteJoinRequest,
  searchDiscoverableBands,
} from "@/services/joinRequests"
import { toFriendlyError } from "@/services/errors"
import type { DiscoverableOrganization, JoinRequest } from "@/interfaces"

/**
 * Find a band and ask to join (roadmap #60): an exact-name search over the
 * opt-in directory — equality only on purpose, so nobody can ever enumerate
 * the bands that said yes. Each row wears its own state from the caller's own
 * live asks: ask, wait, withdraw, ask again. Approving on the other side mints
 * a normal invitation, so acceptance happens in the band switcher like always.
 */
export default function DiscoverScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const toast = useToast()
  const { user, profile } = useAuth()
  const myUid = user?.uid ?? profile?.uid ?? null
  const { requests: myRequests } = useMyJoinRequests(myUid)

  const [name, setName] = useState("")
  const [results, setResults] = useState<DiscoverableOrganization[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [asking, setAsking] = useState<DiscoverableOrganization | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  const displayName = profile?.displayName || user?.displayName || user?.email || ""
  const email = profile?.email || user?.email || ""

  const search = async (): Promise<void> => {
    setSearching(true)
    try {
      setResults(await searchDiscoverableBands(name))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("discover.searchFailed")))
    } finally {
      setSearching(false)
    }
  }

  const send = async (): Promise<void> => {
    if (!asking) return
    setBusy(true)
    try {
      await createJoinRequest({
        organizationId: asking.id,
        displayName,
        email,
        note,
      })
      setAsking(null)
      setNote("")
      toast.showSuccess(t("discover.requestSent", { name: asking.name }))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("discover.requestFailed")))
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async (request: JoinRequest): Promise<void> => {
    try {
      await deleteJoinRequest(request.organizationId, request.uid)
      toast.showSuccess(t("discover.withdrawn"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("discover.requestFailed")))
    }
  }

  const renderAction = (organization: DiscoverableOrganization): React.ReactNode => {
    const mine = myRequests.find((entry) => entry.organizationId === organization.id)
    if (mine?.status === "pending") {
      return (
        <View style={styles.rowState}>
          <AppText variant="caption" tone="muted">
            {t("discover.waiting")}
          </AppText>
          <Button
            label={t("discover.withdraw")}
            size="sm"
            variant="ghost"
            onPress={() => void withdraw(mine)}
          />
        </View>
      )
    }
    if (mine?.status === "approved") {
      return (
        <View style={styles.rowState}>
          <Badge label={t("discover.approved")} tone="primary" />
          <AppText variant="caption" tone="faint">
            {t("discover.approvedHint")}
          </AppText>
        </View>
      )
    }
    return (
      <Button
        label={mine?.status === "rejected" ? t("discover.askAgain") : t("discover.requestToJoin")}
        size="sm"
        onPress={() => {
          setNote("")
          setAsking(organization)
        }}
      />
    )
  }

  return (
    <ScreenContainer
      title={t("discover.title")}
      subtitle={t("discover.subtitle")}
      back
    >
      <Card style={styles.card}>
        <SearchInput
          label={t("discover.searchLabel")}
          value={name}
          onChangeText={setName}
          placeholder={t("discover.searchPlaceholder")}
          autoCapitalize="words"
          onSubmitEditing={() => void search()}
        />
        <Button
          label={t("discover.search")}
          loading={searching}
          onPress={() => void search()}
        />
        <AppText variant="caption" tone="faint">
          {t("discover.hint")}
        </AppText>
      </Card>

      {results === null ? null : results.length === 0 ? (
        <EmptyState
          icon={<SearchIcon size={24} color={Theme.colors.primary} />}
          title={t("discover.noResults")}
          message={t("discover.noResultsHint")}
        />
      ) : (
        <View style={styles.list}>
          {results.map((organization) => (
            <Card key={organization.id} style={styles.resultRow}>
              <View style={styles.flex}>
                <AppText variant="subheading" numberOfLines={1}>
                  {organization.name}
                </AppText>
              </View>
              {renderAction(organization)}
            </Card>
          ))}
        </View>
      )}

      <Dialog
        visible={asking !== null}
        onClose={() => setAsking(null)}
        title={t("discover.confirmTitle", { name: asking?.name ?? "" })}
        description={t("discover.confirmDescription")}
        confirmLabel={t("discover.send")}
        confirmLoading={busy}
        onConfirm={() => void send()}
      >
        <Input
          label={t("discover.noteLabel")}
          value={note}
          onChangeText={setNote}
          placeholder={t("discover.notePlaceholder")}
          multiline
        />
        <AppText variant="caption" tone="faint">
          {t("discover.shareNote", { email: email || t("common.notAvailable") })}
        </AppText>
      </Dialog>
    </ScreenContainer>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.m },
    list: { gap: Theme.spacing.m },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
    },
    rowState: { alignItems: "flex-end", gap: 2 },
    flex: { flex: 1, minWidth: 0 },
  })

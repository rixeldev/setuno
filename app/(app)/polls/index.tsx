import React from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Card, Chip } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { EmptyState, Skeleton } from "@/components/ui/States"
import { ModalScreen } from "@/components/app/ModalScreen"
import { PlusIcon } from "@/components/ui/Icons"
import { useOrganization } from "@/hooks/useOrganization"
import { usePolls } from "@/hooks/useDatePolls"

/**
 * The band's date polls (roadmap #48): open ones first, closed behind. No
 * tally here on purpose — each poll's votes are their own listener, and the
 * list stays one subscription; the detail screen does the counting.
 */
export default function PollsList() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const { organizationId } = useOrganization()
  const { polls, loading } = usePolls(organizationId)

  return (
    <ModalScreen title={t("polls.title")} subtitle={t("polls.subtitle")}>
      {loading ? <Skeleton height={220} /> : null}

      {!loading && polls.length === 0 ? (
        <EmptyState
          title={t("polls.empty")}
          message={t("polls.emptyHint")}
          actionLabel={t("polls.newPoll")}
          onAction={() => router.push("/polls/new")}
        />
      ) : null}

      {polls.map((poll) => (
        <Card key={poll.id} style={styles.card}>
          <View style={styles.row}>
            <View style={styles.body}>
              <AppText variant="bodyStrong" numberOfLines={2}>
                {poll.title}
              </AppText>
              <AppText variant="caption" tone="muted">
                {t("polls.datesCount", { count: poll.options.length })}
              </AppText>
            </View>
            <Chip
              size="sm"
              label={poll.status === "open" ? t("polls.open") : t("polls.closed")}
              tone={poll.status === "open" ? "primary" : "default"}
            />
          </View>
          <Button
            label={t("polls.openPoll")}
            variant="secondary"
            size="sm"
            onPress={() => router.push(`/polls/${poll.id}`)}
          />
        </Card>
      ))}

      {!loading && polls.length > 0 ? (
        <Button
          label={t("polls.newPoll")}
          variant="secondary"
          full
          icon={<PlusIcon size={18} color={Theme.colors.text} />}
          onPress={() => router.push("/polls/new")}
        />
      ) : null}
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.m },
    row: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    body: { flex: 1, minWidth: 0, gap: 2 },
  })

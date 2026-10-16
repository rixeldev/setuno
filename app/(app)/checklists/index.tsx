import React from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Card, Chip } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States"
import { ModalScreen } from "@/components/app/ModalScreen"
import { PlusIcon } from "@/components/ui/Icons"
import { useOrganization } from "@/hooks/useOrganization"
import { useChecklists } from "@/hooks/useChecklists"
import { CHECKLIST_KIND_KEYS } from "@/interfaces/checklist"

/**
 * The band's reusable checklists (roadmap #49): kind then name, one
 * subscription. Tapping a row opens its editor; attaching happens from an
 * event's task card — this screen only curates the library.
 */
export default function ChecklistsList() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const { organizationId } = useOrganization()
  const { lists, loading, error } = useChecklists(organizationId)

  const newItem = (): void => router.push("/checklists/new")

  return (
    <ModalScreen title={t("checklists.title")} subtitle={t("checklists.subtitle")}>
      {loading ? <Skeleton height={220} /> : null}

      {error ? <ErrorState message={error} /> : null}

      {!loading && !error && lists.length === 0 ? (
        <EmptyState
          title={t("checklists.empty")}
          message={t("checklists.emptyHint")}
          actionLabel={t("checklists.newChecklist")}
          onAction={newItem}
        />
      ) : null}

      {lists.map((list) => (
        <Card
          key={list.id}
          style={styles.card}
          onPress={() => router.push(`/checklists/${list.id}`)}
          accessibilityLabel={`${list.name}, ${t(CHECKLIST_KIND_KEYS[list.kind])}`}
        >
          <View style={styles.row}>
            <View style={styles.body}>
              <AppText variant="bodyStrong" numberOfLines={2}>
                {list.name}
              </AppText>
              <AppText variant="caption" tone="muted">
                {t("checklists.itemsCount", { count: list.items.length })}
              </AppText>
            </View>
            <Chip size="sm" tone="primary" label={t(CHECKLIST_KIND_KEYS[list.kind])} />
          </View>
        </Card>
      ))}

      {!loading && !error && lists.length > 0 ? (
        <Button
          label={t("checklists.newChecklist")}
          variant="secondary"
          full
          icon={<PlusIcon size={18} color={Theme.colors.text} />}
          onPress={newItem}
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

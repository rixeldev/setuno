import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { LightbulbIcon } from "@/components/ui/Icons"
import type { TourStepCopy } from "@/libs/onboarding"

interface TourHintProps {
  steps: TourStepCopy[]
  /** Label of the primary button on the last step. */
  doneLabel: string
  /** Last step confirmed: usually leaves for the next part of the tour. */
  onDone: () => void
  /** The tips are dismissed without finishing (the user stays where they are). */
  onSkip: () => void
  icon?: React.ReactNode
}

/**
 * Step-by-step contextual tips (roadmap #65). Rendered inside the real reader
 * and editor, so the tour explains the very controls the user is looking at
 * instead of a mock-up. Dismissing it never touches stored data.
 */
export function TourHint({ steps, doneLabel, onDone, onSkip, icon }: TourHintProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const step = steps[index]
  if (!step) return null
  const isLast = index === steps.length - 1

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        {icon ?? <LightbulbIcon size={18} color={Theme.colors.primary} />}
        <AppText variant="label" tone="faint">
          {t("onboarding.tourStep", { current: index + 1, total: steps.length })}
        </AppText>
      </View>

      <AppText variant="subheading">{t(step.titleKey)}</AppText>
      <AppText variant="caption" tone="muted">
        {t(step.bodyKey)}
      </AppText>

      <View style={styles.actions}>
        <Button
          label={isLast ? doneLabel : t("onboarding.tourNext")}
          size="sm"
          onPress={isLast ? onDone : () => setIndex(index + 1)}
        />
        <Button
          label={t("onboarding.tourSkip")}
          variant="ghost"
          size="sm"
          onPress={onSkip}
        />
      </View>
    </Card>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      gap: Theme.spacing.s,
      borderWidth: 1,
      borderColor: Theme.colors.primary,
      backgroundColor: Theme.colors.background2,
    },
    header: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    actions: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s, flexWrap: "wrap" },
  })

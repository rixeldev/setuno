import React from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { useThemedStyles } from "@/hooks/useThemedStyles"
import { Chip } from "@/components/ui/Card"
import { memberRoleA11y, visibleRoleIds } from "@/libs/bandRoles"

interface MemberRoleChipsProps {
  /** The member's stored `instruments` (healed inside). */
  instruments: readonly string[]
}

/**
 * A member's roles as at most two chips plus a "+N" pill (roadmap #88).
 *
 * The roster row also carries the name, the band role, the email and two
 * actions, so a long list of chips crowded all of them — it is a **summary**,
 * not the profile. The hidden roles still count, so nobody reads "two roles"
 * where the member declared five, and the whole line is announced in one go by
 * screen readers instead of chip by chip.
 */
export function MemberRoleChips({ instruments }: MemberRoleChipsProps) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const { shown, hidden } = visibleRoleIds(instruments)

  if (shown.length === 0) return null

  const spoken = t("members.rolesA11y", { roles: memberRoleA11y(instruments, t) })

  return (
    <View style={styles.chips} accessible accessibilityLabel={spoken}>
      {shown.map((id) => (
        <Chip
          key={id}
          label={t(`bandRoles.${id}`)}
          size="sm"
          disabled
          accessibilityLabel={t(`bandRoles.${id}`)}
          style={styles.chip}
        />
      ))}
      {hidden > 0 ? (
        <Chip
          label={t("members.moreRoles", { count: hidden })}
          size="sm"
          disabled
          accessibilityLabel={t("members.moreRolesA11y", { count: hidden })}
          style={styles.chip}
        />
      ) : null}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 2 },
    chip: { maxWidth: "100%" },
  })

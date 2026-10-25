import React from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Chip } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { BAND_ROLES } from "@/libs/bandRoles"
import type { OrganizationMember } from "@/interfaces"

interface MemberInstrumentsDialogProps {
  visible: boolean
  member: OrganizationMember | null
  /** The draft the dialog is editing. */
  selected: string[]
  onChange: (next: string[]) => void
  onClose: () => void
  onSave: () => void
  busy?: boolean
}

/**
 * "What this member plays" (roadmap #88) — a multi-select over the catalogue.
 *
 * A member may declare several chairs ("I sing and play guitar"), and the
 * same chair may be declared by several members. The draft is held by the
 * caller and committed on Save, so a stray tap never writes half a profile.
 */
export function MemberInstrumentsDialog({
  visible,
  member,
  selected,
  onChange,
  onClose,
  onSave,
  busy = false,
}: MemberInstrumentsDialogProps) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)

  const toggle = (id: string): void => {
    if (selected.includes(id)) {
      onChange(selected.filter((entry) => entry !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={t("members.instrumentsTitle", { name: member?.displayName ?? "" })}
      description={t("members.instrumentsDescription")}
      confirmLabel={t("common.save")}
      confirmDisabled={busy}
      confirmLoading={busy}
      onConfirm={onSave}
    >
      <View style={styles.chips}>
        {BAND_ROLES.map((role) => (
          <Chip
            key={role.id}
            label={t(role.labelKey)}
            selected={selected.includes(role.id)}
            onPress={() => toggle(role.id)}
            accessibilityLabel={t(role.labelKey)}
          />
        ))}
      </View>
      {selected.length === 0 ? (
        <AppText variant="caption" tone="faint">
          {t("members.instrumentsNoneHint")}
        </AppText>
      ) : null}
    </Dialog>
  )
}

const createStyles = () =>
  StyleSheet.create({
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  })

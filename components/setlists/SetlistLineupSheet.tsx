import React, { useState } from "react"
import { StyleSheet } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import {
  autoLineup,
  bandRoleLabel,
  missingFromLineup,
  rolesForMember,
  sanitizeRoleIds,
} from "@/libs/bandRoles"
import type { OrganizationMember } from "@/interfaces"

interface SetlistLineupSheetProps {
  visible: boolean
  /** The song whose cast is being set. */
  songTitle: string
  /** The band's roster — the only people a song can be cast with. */
  members: readonly OrganizationMember[]
  /** Current cast: member uid → role id. */
  lineup: Record<string, string>
  /** Writes through: every tap is a save, exactly like an RSVP. */
  onChange: (next: Record<string, string>) => void
  onClose: () => void
}

/**
 * "Who plays this song" (roadmap #88) — the per-song line-up of an event's
 * running order.
 *
 * Two steps in the same sheet, because a band has more members than a phone has
 * room: the roster first (each row saying whether they are on the song and as
 * what), then the roles for the member tapped. A member's own instruments come
 * first — that is usually the answer — and the rest of the catalogue follows,
 * because the leader is allowed to cast somebody outside their usual chair.
 *
 * **One role per member, any number of members per role.** Choosing a role
 * replaces the previous one, so the same person can never appear twice on a
 * song; "Not playing" removes them.
 */
export function SetlistLineupSheet({
  visible,
  songTitle,
  members,
  lineup,
  onChange,
  onClose,
}: SetlistLineupSheetProps) {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  // Who is being cast right now; `null` is the roster step. Seeded by the press
  // that opens it and cleared by the close, never synced from an effect.
  const [picking, setPicking] = useState<string | null>(null)

  const member = picking ? (members.find((entry) => entry.uid === picking) ?? null) : null
  // The soft warning the roster step prints: who the song currently leaves out.
  const missing = missingFromLineup(members, lineup)
  // "Everyone plays their usual chair" only means something once somebody
  // declared one — a control that would change nothing is not rendered.
  const canAuto = members.some((entry) => sanitizeRoleIds(entry.instruments).length > 0)

  const close = (): void => {
    setPicking(null)
    onClose()
  }

  const assign = (uid: string, roleId: string | null): void => {
    const next = { ...lineup }
    if (roleId) next[uid] = roleId
    else delete next[uid]
    onChange(next)
    setPicking(null)
  }

  const cast = (uid: string): string => {
    const roleId = lineup[uid]
    return roleId ? bandRoleLabel(roleId, t) : t("setlists.lineupNotPlaying")
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title={songTitle}
      subtitle={
        member ?
          t("setlists.lineupPickRole", { name: member.displayName })
        : t("setlists.lineupSubtitle")
      }
    >
      {member ? (
        <>
          <SheetOptionRow
            label={t("setlists.lineupBack")}
            hint={t("setlists.lineupSubtitle")}
            onPress={() => setPicking(null)}
          />
          <SheetOptionRow
            label={t("setlists.lineupNotPlaying")}
            selected={!lineup[member.uid]}
            onPress={() => assign(member.uid, null)}
          />
          {rolesForMember(member).map((roleId) => (
            <SheetOptionRow
              key={roleId}
              label={bandRoleLabel(roleId, t)}
              // The member's own instruments are marked, so the leader can tell
              // the chair somebody usually takes from an unusual ask.
              hint={member.instruments.includes(roleId) ? t("setlists.lineupTheirRole") : undefined}
              selected={lineup[member.uid] === roleId}
              onPress={() => assign(member.uid, roleId)}
            />
          ))}
        </>
      ) : (
        <>
          {canAuto ? (
            <SheetOptionRow
              label={t("setlists.lineupAuto")}
              hint={t("setlists.lineupAutoHint")}
              onPress={() => onChange(autoLineup(members, lineup))}
            />
          ) : null}
          {members.map((entry) => (
            <SheetOptionRow
              key={entry.uid}
              label={entry.displayName || entry.email}
              hint={cast(entry.uid)}
              selected={Boolean(lineup[entry.uid])}
              onPress={() => setPicking(entry.uid)}
            />
          ))}
          {Object.keys(lineup).length > 0 ? (
            <SheetOptionRow
              label={t("setlists.lineupClear")}
              hint={t("setlists.lineupClearHint")}
              onPress={() => onChange({})}
            />
          ) : null}
          {missing.length > 0 ? (
            <AppText variant="caption" tone="faint" style={styles.missing}>
              {t("setlists.lineupMissing", {
                names: missing
                  .map((entry) => entry.displayName || entry.email)
                  .join(", "),
              })}
            </AppText>
          ) : null}
        </>
      )}
    </BottomSheet>
  )
}

const createStyles = () =>
  StyleSheet.create({
    missing: { paddingHorizontal: Theme.spacing.xs, paddingTop: Theme.spacing.xs },
  })

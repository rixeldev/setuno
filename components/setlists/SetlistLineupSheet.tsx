import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import { bandRoleLabel, rolesForMember } from "@/libs/bandRoles"
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
  // Who is being cast right now; `null` is the roster step. Seeded by the press
  // that opens it and cleared by the close, never synced from an effect.
  const [picking, setPicking] = useState<string | null>(null)

  const member = picking ? (members.find((entry) => entry.uid === picking) ?? null) : null

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
        </>
      )}
    </BottomSheet>
  )
}

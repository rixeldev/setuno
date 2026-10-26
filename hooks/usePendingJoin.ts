import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { useToast } from "@/components/ui/Toast"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { isInviteLinkGone } from "@/libs/inviteLink"
import { toFriendlyError } from "@/services/errors"
import { redeemInviteLink } from "@/services/inviteLinks"
import { clearPendingJoin, readPendingJoin } from "@/services/pendingJoin"

/**
 * Finishes an invitation link the visitor could not redeem yet (roadmap #89).
 *
 * The join page parks the token when there is no account; this runs inside the
 * authenticated shell, **once per launch**, and redeems it as soon as the
 * profile exists (the membership write and the band switch both need it). A
 * link that turned out to be dead is forgotten, so it is never retried; a link
 * that simply could not be reached (offline, a cold Functions deploy) stays
 * parked and the next launch finishes the join instead of losing it.
 *
 * Deliberately silent on the happy path beyond one toast — the band simply
 * appears in the switcher and becomes the active one, exactly as if the email
 * invitation had been accepted on the welcome screen.
 */
export function usePendingJoin(): void {
  const { status, profile } = useAuth()
  const { switchOrganization } = useOrganization()
  const toast = useToast()
  const { t } = useTranslation()
  // A ref, not state: it guards the attempt across the profile snapshots that
  // arrive while the redemption is in flight, and never triggers a render. The
  // run is not cancelled on a StrictMode remount on purpose — the write is
  // already on its way to the server, and dropping its answer would leave the
  // new band unselected.
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    if (status !== "signed-in" || !profile) return
    attempted.current = true

    void (async () => {
      const pending = await readPendingJoin()
      if (!pending) return
      try {
        const result = await redeemInviteLink(pending.token)
        await clearPendingJoin()
        await switchOrganization(result.organizationId)
        toast.showSuccess(
          result.alreadyMember
            ? t("join.alreadyMemberToast", { band: result.organizationName })
            : t("join.joinedToast", { band: result.organizationName }),
        )
      } catch (error) {
        const gone = isInviteLinkGone(error)
        if (gone) await clearPendingJoin()
        toast.showError(gone ? t("join.goneTitle") : toFriendlyError(error, t("join.failedMessage")))
      }
    })()
  }, [status, profile, switchOrganization, toast, t])
}

import { useState } from "react"

import { saveShowNotes } from "@/services/performances"
import type { ShowNote } from "@/interfaces"

const EMPTY: ShowNote[] = []

/**
 * One event's night notes (roadmap #90), write-through with a local copy that
 * takes over the moment this screen changes the feed — the same pattern the
 * post-gig report uses for the show log.
 *
 * The local copy is **tagged with the event id**, so switching events reads the
 * other event's stored notes instead of this screen's. Without it two notes
 * written before the subscription echoed would both start from the same stale
 * array and the second would silently drop the first.
 */
export function useShowNotes(
  organizationId: string | null,
  performanceId: string | null,
  stored: readonly ShowNote[] = EMPTY,
) {
  const [local, setLocal] = useState<{ id: string; notes: ShowNote[] } | null>(null)
  const notes = local && local.id === performanceId ? local.notes : stored

  const save = async (next: ShowNote[]): Promise<void> => {
    if (!organizationId || !performanceId) return
    // Written first, remembered second: Firestore resolves an offline write as
    // soon as it is queued, so this still feels instant — and a rejection (a
    // rule, a dead session) leaves the screen showing what is really stored
    // instead of a note nobody else will ever see.
    await saveShowNotes(organizationId, performanceId, next)
    setLocal({ id: performanceId, notes: next })
  }

  return { notes, save }
}

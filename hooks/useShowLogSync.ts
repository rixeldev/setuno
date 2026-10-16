import { useEffect, useRef } from "react"

import { readLiveShow, subscribeLiveShow } from "@/hooks/useReaderSession"
import { saveShowLog } from "@/services/performances"

/**
 * Persists the live show log while the band runs a show (roadmap #45): the
 * clock stays in memory, but every change to the log — an arrival banking its
 * seconds, a mark, the final close on stop — is written to the event document
 * through `saveShowLog`, so the post-gig report opens filled in and a killed
 * app cannot lose the night.
 *
 * Only the reader whose setlist the show was started from syncs, and only
 * while the session actually belongs to an attached event. Writes are
 * whole-array snapshots (small, one entry per song), deduped against the last
 * payload so a break tap or a clock tick never hits Firestore. Failures are
 * swallowed like `logActivity`: an offline write queues itself, and a rejected
 * one only leaves the session running — the report screen surfaces problems
 * when it saves explicitly.
 */
export function useShowLogSync(
  setlistId: string | null,
  performanceId: string | null,
  organizationId: string | null,
): void {
  const lastRef = useRef<string | null>(null)

  useEffect(() => {
    if (!setlistId || !performanceId || !organizationId) return undefined
    lastRef.current = null
    return subscribeLiveShow(() => {
      const show = readLiveShow()
      // The session survives a stop (its log is the final write's source) and
      // can outlive this reader; only this setlist's show is ours to persist.
      if (show.setlistId !== setlistId) return
      const payload = JSON.stringify(show.log)
      if (payload === lastRef.current) return
      lastRef.current = payload
      void saveShowLog(organizationId, performanceId, show.log).catch(() => undefined)
    })
  }, [setlistId, performanceId, organizationId])
}

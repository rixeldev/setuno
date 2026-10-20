import { useEffect } from "react"

import { beginShowRead, endShowRead } from "@/services/reviewPrompt"

/**
 * The reader's half of the in-app review (roadmap #71): while a setlist read
 * is on screen its occasion is open, and leaving the reader for good schedules
 * the store prompt — behind the milestone and the store quotas, never in the
 * UI's way. `enabled` is the setlist param, so browsing the general songbook
 * counts nothing. Module store calls only (the show-log effect's pattern),
 * never a render-phase setState.
 */
export const useReviewPrompt = (enabled: boolean): void => {
  useEffect(() => {
    if (!enabled) return
    beginShowRead()
    return () => endShowRead()
  }, [enabled])
}

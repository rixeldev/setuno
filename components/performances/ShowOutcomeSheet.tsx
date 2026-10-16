import React from "react"
import { useTranslation } from "react-i18next"

import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import { SHOW_OUTCOMES } from "@/libs/showLog"
import { SHOW_OUTCOME_KEYS } from "@/interfaces/performance"
import type { ShowOutcome } from "@/interfaces/performance"

interface ShowOutcomeSheetProps {
  visible: boolean
  onClose: () => void
  /** The song the marks apply to, shown as the sheet's subtitle. */
  songTitle: string
  /** The song's current mark, ticked in the list (null when never logged). */
  outcome: ShowOutcome | null
  onSelect: (outcome: ShowOutcome) => void
}

/**
 * The one outcome picker of the show log (roadmap #45), shared by the live
 * strip (marking while the band plays) and the post-gig report (correcting
 * afterwards) so the two can never drift apart. Session-only in the strip —
 * the mark reaches Firestore through the reader's log sync, never inline.
 */
export function ShowOutcomeSheet({
  visible,
  onClose,
  songTitle,
  outcome,
  onSelect,
}: ShowOutcomeSheetProps) {
  const { t } = useTranslation()
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("showLog.markTitle")}
      subtitle={songTitle}
    >
      {SHOW_OUTCOMES.map((value) => (
        <SheetOptionRow
          key={value}
          label={t(SHOW_OUTCOME_KEYS[value])}
          selected={outcome === value}
          onPress={() => {
            onClose()
            onSelect(value)
          }}
        />
      ))}
    </BottomSheet>
  )
}

import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { formatRelativeDay } from "@/libs/format"
import { buildHomeWidgetContent, nextWidgetEvent, type WidgetEvent } from "@/libs/homeWidget"
import { parseIsoDate } from "@/libs/validation"
import { publishWidget } from "@/services/homeWidget"

/**
 * Keeps the Android home-screen widget up to date (roadmap #78).
 *
 * The widget cannot read the band's data itself, so the app hands it what it
 * already knows: the next gig, when it is, where, and which setlist they
 * will play. The push happens in an effect — the clock is read there, never
 * while rendering.
 *
 * The content is as fresh as the last time the app was open: the launcher
 * asks nobody for a live feed, and a widget that woke the app on every draw
 * would cost more than it is worth.
 */
export const useHomeWidget = (): void => {
  const { t } = useTranslation()
  const { organization } = useOrganization()
  const { performances } = useOrgData()

  const events = useMemo<WidgetEvent[]>(
    () =>
      performances.map((performance) => ({
        id: performance.id,
        name: performance.name,
        date: performance.date,
        venue: performance.venue?.name ?? "",
        setlistNames: performance.setlists.map((setlist) => setlist.name),
        status: performance.status,
      })),
    [performances],
  )

  const bandName = organization?.name ?? ""

  useEffect(() => {
    const now = new Date()
    const today = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`
    const event = nextWidgetEvent(events, today)
    const content = buildHomeWidgetContent({
      bandName,
      event,
      when:
        event === null
          ? ""
          : formatRelativeDay(parseIsoDate(event.date), {
              today: t("common.today"),
              tomorrow: t("common.tomorrow"),
              yesterday: t("common.yesterday"),
            }),
      nothingScheduled: t("widget.nothingScheduled"),
    })
    publishWidget(content)
  }, [bandName, events, t])
}

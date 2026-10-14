import { buildIcsCalendar, icsFileName, performanceToIcsEvent } from "@/libs/ics"
import { exportTextFile } from "@/libs/exportFile"
import type { Performance } from "@/interfaces"

const ICS_MIME_TYPE = "text/calendar"
const ICS_UTI = "com.apple.ical.ics"

export interface CalendarExportOptions {
  performances: Performance[]
  organizationId: string
  /** Feed name shown by the calendar app. */
  calendarName: string
  /** Basis for the download file name (`setuno-<label>.ics`). */
  fileLabel: string
  dialogTitle?: string
}

/**
 * Turns performances into an `.ics` file and hands it to the platform (share
 * sheet on native, download on web). Resolves `false` when the platform has no
 * way to deliver the file, so the caller can show a message.
 *
 * Cancelled events are skipped: they only add noise to a personal calendar.
 */
export const exportPerformancesToIcs = async (
  options: CalendarExportOptions,
): Promise<boolean> => {
  const events = options.performances
    .filter((performance) => performance.status !== "cancelled")
    .map((performance) => performanceToIcsEvent(performance, options.organizationId))
  const content = buildIcsCalendar(events, { calendarName: options.calendarName })
  return exportTextFile({
    fileName: icsFileName(options.fileLabel),
    content,
    mimeType: ICS_MIME_TYPE,
    uti: ICS_UTI,
    dialogTitle: options.dialogTitle,
  })
}

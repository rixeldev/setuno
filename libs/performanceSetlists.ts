import type { PerformanceSetlist } from "@/interfaces"

/**
 * Compact label for single-line spots (cards, dashboard hero): the first `max`
 * setlist names plus a "+N" tail when the event carries more.
 */
export const setlistSummary = (setlists: PerformanceSetlist[], max = 1): string => {
  const names = setlists.map((entry) => entry.name.trim()).filter((name) => name.length > 0)
  if (names.length === 0) return ""
  if (names.length <= max) return names.join(" · ")
  return `${names.slice(0, max).join(" · ")} +${names.length - max}`
}

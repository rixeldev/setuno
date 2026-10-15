import type { Performance } from "@/interfaces/performance"
import type { Setlist } from "@/interfaces/setlist"
import { formatDateRange } from "@/libs/format"

export type SetlistGroupKind = "templates" | "event" | "unattached"

export interface SetlistGroup {
  key: string
  kind: SetlistGroupKind
  title: string
  subtitle?: string
  eventId?: string
  lists: Setlist[]
}

interface GroupSetlistsArgs {
  setlists: readonly Setlist[]
  /** Every show the band has, past and future — decides what counts as attached. */
  performances: readonly Performance[]
  /** The shows that get a group of their own, in the order they arrive. */
  upcomingPerformances: readonly Performance[]
  language: string
  templatesTitle: string
  unattachedTitle: string
}

/**
 * What the setlists screen shows, and in what order (docs §20, roadmap #41).
 *
 * **Templates come first**: they are the shelf the running orders are copied
 * from, and they belong to no event — a template never appears under the
 * "not attached to an event" heading, which is exactly the difference between
 * a reusable list and one nobody has placed yet.
 *
 * Then every upcoming scheduled show with at least one list attached, and
 * finally the lists attached to nothing (a list an event already used stays
 * off this section: it is reachable from that event instead).
 *
 * Kept out of the screen because three rules interact here — what "attached"
 * means, what a template is not, and that an event with no lists shows nothing
 * — and each one is worth a test.
 */
export const groupSetlists = ({
  setlists,
  performances,
  upcomingPerformances,
  language,
  templatesTitle,
  unattachedTitle,
}: GroupSetlistsArgs): SetlistGroup[] => {
  const byId = new Map(setlists.map((entry) => [entry.id, entry]))

  const templates = setlists.filter((entry) => entry.template)

  const eventGroups: SetlistGroup[] = upcomingPerformances
    .filter((performance) => performance.status === "scheduled")
    .map((performance) => ({
      key: performance.id,
      kind: "event" as const,
      title: performance.name,
      subtitle: formatDateRange(performance.date, performance.endDate, language),
      eventId: performance.id,
      lists: performance.setlists
        .map((reference) => byId.get(reference.id))
        .filter((entry): entry is Setlist => entry !== undefined),
    }))
    .filter((group) => group.lists.length > 0)

  const unattached = setlists.filter(
    (entry) =>
      !entry.template &&
      !performances.some((performance) =>
        performance.setlists.some((reference) => reference.id === entry.id),
      ),
  )

  return [
    ...(templates.length > 0 ?
      [{ key: "templates", kind: "templates" as const, title: templatesTitle, lists: templates }]
    : []),
    ...eventGroups,
    ...(unattached.length > 0 ?
      [{ key: "unattached", kind: "unattached" as const, title: unattachedTitle, lists: unattached }]
    : []),
  ]
}

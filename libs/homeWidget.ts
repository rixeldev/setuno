/**
 * The Android home-screen widget's content (roadmap #78). Pure — no React
 * Native imports, so the unit suite can check what the widget would show.
 *
 * The widget shows the band's **next gig**: when it is, where, and which
 * setlist they will play. The app pushes the content already localized, so
 * the launcher never needs the app's translations.
 */

/** The event the widget may show, reduced to what it needs. */
export interface WidgetEvent {
  id: string
  name: string
  /** The event's date, `yyyy-mm-dd`. */
  date: string
  venue: string
  setlistNames: string[]
  status: string
}

/** What the widget draws. */
export interface HomeWidgetContent {
  bandName: string
  title: string
  subtitle: string
  detail: string
  route: string
}

/**
 * The next gig: the soonest **scheduled** event from today on.
 *
 * Cancelled events never happened and completed ones are history, so neither
 * is ever the widget's headline. The order is by date and then by id, so the
 * same data always picks the same event.
 */
export const nextWidgetEvent = (
  events: readonly WidgetEvent[],
  today: string,
): WidgetEvent | null => {
  const upcoming = events
    .filter((event) => event.status === "scheduled")
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  return upcoming[0] ?? null
}

/**
 * Builds what the widget shows.
 *
 * With no gig ahead the widget says so instead of going blank — a home
 * screen that says nothing looks broken, and the band still wants to know the
 * app is there.
 */
export const buildHomeWidgetContent = (input: {
  bandName: string
  event: WidgetEvent | null
  /** The event's date, already formatted ("Today", "Tomorrow", a date). */
  when: string
  /** What to say when there is nothing scheduled. */
  nothingScheduled: string
}): HomeWidgetContent => {
  const bandName = input.bandName.trim()
  if (!input.event) {
    return {
      bandName,
      title: input.nothingScheduled,
      subtitle: "",
      detail: "",
      route: "",
    }
  }
  const venue = input.event.venue.trim()
  const setlists = input.event.setlistNames.filter((name) => name.trim().length > 0)
  return {
    bandName,
    title: input.event.name,
    subtitle: [input.when, venue].filter((part) => part.length > 0).join(" · "),
    detail: setlists.join(" · "),
    route: `performances/${input.event.id}`,
  }
}

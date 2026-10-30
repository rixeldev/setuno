import type { ComponentType } from "react"

import type { OrganizationRole } from "@/interfaces"

import {
  CalendarIcon,
  ChatIcon,
  GridIcon,
  LibraryIcon,
  ListIcon,
  MusicIcon,
  OrganizationIcon,
  SettingsIcon,
  StatsIcon,
  TunerIcon,
  GuitarIcon,
  UsersIcon,
} from "@/components/ui/Icons"

export interface NavItem {
  href: string
  /** i18n key of the label shown in the navigation. */
  label: string
  icon: ComponentType<{ size?: number; color?: string }>
  /** i18n key of the one-line description shown on the “More” tiles. */
  description?: string
  /** Hidden from the mobile bottom bar (still available in More / sidebar). */
  secondary?: boolean
  /** Only visible to organization admins. */
  adminOnly?: boolean
  /**
   * Hidden from guests (roadmap #59): the security rules deny the whole
   * surface, so the door is withheld rather than shown and rejected. The
   * activity feed and its badge ride the same rule.
   */
  memberOnly?: boolean
  /** Shows the pending suggestion counter. */
  badge?: "suggestions" | "activity"
  /**
   * i18n key of the sidebar section this entry belongs to. Entries are rendered
   * in order, and the sidebar prints a heading whenever the group changes — a
   * flat list of twelve destinations reads like a wall.
   */
  group?: string
}

/** Desktop / web sidebar navigation (docs §18). */
export const SIDEBAR_NAV: NavItem[] = [
  { href: "/", label: "nav.dashboard", icon: GridIcon, badge: "activity", group: "nav.groupMusic" },
  { href: "/songs", label: "nav.songs", icon: MusicIcon, group: "nav.groupMusic" },
  { href: "/setlists", label: "nav.setlists", icon: ListIcon, group: "nav.groupMusic" },
  { href: "/performances", label: "nav.performances", icon: CalendarIcon, group: "nav.groupMusic" },
  { href: "/calendar", label: "nav.calendar", icon: CalendarIcon, secondary: true, group: "nav.groupMusic" },
  {
    href: "/suggestions",
    label: "nav.suggestions",
    icon: ChatIcon,
    badge: "suggestions",
    memberOnly: true,
    group: "nav.groupBand",
  },
  { href: "/members", label: "nav.members", icon: UsersIcon, group: "nav.groupBand" },
  { href: "/collections", label: "nav.collections", icon: LibraryIcon, group: "nav.groupBand" },
  { href: "/stats", label: "nav.stats", icon: StatsIcon, group: "nav.groupTools" },
  { href: "/tuner", label: "nav.tuner", icon: TunerIcon, group: "nav.groupTools" },
  { href: "/chords", label: "nav.chords", icon: GuitarIcon, group: "nav.groupTools" },
  { href: "/settings", label: "nav.settings", icon: SettingsIcon, group: "nav.groupAccount" },
]

/** Mobile bottom bar (docs §18): four primary destinations plus More. */
export const MOBILE_NAV: NavItem[] = [
  { href: "/", label: "nav.home", icon: GridIcon, badge: "activity" },
  { href: "/songs", label: "nav.songs", icon: MusicIcon },
  { href: "/performances", label: "nav.gigs", icon: CalendarIcon },
  { href: "/setlists", label: "nav.setlists", icon: ListIcon },
  { href: "/more", label: "nav.more", icon: SettingsIcon },
]

/** Everything reachable from the mobile “More” screen. */
export const MORE_NAV: NavItem[] = [
  { href: "/calendar", label: "nav.calendar", icon: CalendarIcon, description: "nav.calendarHint" },
  {
    href: "/suggestions",
    label: "nav.suggestions",
    icon: ChatIcon,
    description: "nav.suggestionsHint",
    badge: "suggestions",
    memberOnly: true,
  },
  { href: "/members", label: "nav.members", icon: UsersIcon, description: "nav.membersHint" },
  {
    href: "/collections",
    label: "nav.collections",
    icon: LibraryIcon,
    description: "nav.collectionsHint",
  },
  {
    href: "/stats",
    label: "nav.stats",
    icon: StatsIcon,
    description: "nav.statsHint",
  },
  { href: "/tuner", label: "nav.tuner", icon: TunerIcon, description: "nav.tunerHint" },
  { href: "/chords", label: "nav.chords", icon: GuitarIcon, description: "nav.chordsHint" },
  {
    href: "/organizations",
    label: "nav.switchBand",
    icon: OrganizationIcon,
    description: "nav.switchBandHint",
  },
  { href: "/settings", label: "nav.settings", icon: SettingsIcon, description: "nav.settingsHint" },
]

/**
 * The nav a role may see (roadmap #59): guests sit outside the band's
 * conversation, so `memberOnly` entries — and the badges they carry — never
 * render for them. Pure, so the filter unit-tests without a renderer.
 */
export const visibleNavItems = (items: NavItem[], role: OrganizationRole | null): NavItem[] =>
  role === "guest" ? items.filter((item) => !item.memberOnly) : items

/** True when `pathname` belongs to the nav entry (exact for tabs, prefix for details). */
export const isNavActive = (href: string, pathname: string): boolean => {
  if (href === "/") return pathname === "/"
  if (pathname === href) return true
  return pathname.startsWith(`${href}/`)
}

/**
 * Mobile tab index a pathname belongs to, or `-1` when it matches none.
 * Routes reachable from “More” count as the More tab: tapping a bar entry
 * from a settings screen treats the bar as the origin.
 */
export const tabIndexFor = (pathname: string): number => {
  const direct = MOBILE_NAV.findIndex((item) => isNavActive(item.href, pathname))
  if (direct !== -1) return direct
  if (MORE_NAV.some((item) => isNavActive(item.href, pathname))) {
    return MOBILE_NAV.findIndex((item) => item.href === "/more")
  }
  return -1
}

/**
 * Bottom-bar active state. “More” also owns the routes it hosts (settings,
 * members, suggestions...), so the tab stays highlighted while they are open.
 */
export const isTabActive = (href: string, pathname: string): boolean =>
  isNavActive(href, pathname) ||
  (href === "/more" && MORE_NAV.some((item) => isNavActive(item.href, pathname)))

/**
 * Editing flows that take over the app: while one is open the shell hides its
 * navigation (bottom bar / sidebar) so a stray tap cannot throw work away. The
 * song reader does the same: reading a song is a focused, full-width task.
 */
const FOCUS_ROUTES: RegExp[] = [
  // The first-run tour owns the whole screen, like an editing flow.
  /^\/onboarding$/,
  /^\/songs\/new$/,
  /^\/songs\/[^/]+$/,
  /^\/songs\/[^/]+\/edit$/,
  /^\/songs\/[^/]+\/suggest$/,
  // Version history is a focused review over the reader, like suggest/edit.
  /^\/songs\/[^/]+\/history$/,
  /^\/setlists\/new$/,
  /^\/setlists\/[^/]+\/edit$/,
  /^\/performances\/new$/,
  /^\/performances\/[^/]+\/edit$/,
  // The poll form has a draft (title + dates) like every other create flow.
  /^\/polls\/new$/,
  // So do the checklist forms (name + kind + item titles).
  /^\/checklists\/new$/,
  /^\/checklists\/[^/]+$/,
]

export const isFocusRoute = (pathname: string): boolean =>
  FOCUS_ROUTES.some((pattern) => pattern.test(pathname))

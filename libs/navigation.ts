import type { ComponentType } from "react"

import {
  CalendarIcon,
  ChatIcon,
  GridIcon,
  ListIcon,
  MusicIcon,
  OrganizationIcon,
  SettingsIcon,
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
  /** Shows the pending suggestion counter. */
  badge?: "suggestions"
}

/** Desktop / web sidebar navigation (docs §18). */
export const SIDEBAR_NAV: NavItem[] = [
  { href: "/", label: "nav.dashboard", icon: GridIcon },
  { href: "/songs", label: "nav.songs", icon: MusicIcon },
  { href: "/setlists", label: "nav.setlists", icon: ListIcon },
  { href: "/performances", label: "nav.performances", icon: CalendarIcon },
  { href: "/calendar", label: "nav.calendar", icon: CalendarIcon, secondary: true },
  { href: "/suggestions", label: "nav.suggestions", icon: ChatIcon, badge: "suggestions" },
  { href: "/members", label: "nav.members", icon: UsersIcon },
  { href: "/settings", label: "nav.settings", icon: SettingsIcon },
]

/** Mobile bottom bar (docs §18): four primary destinations plus More. */
export const MOBILE_NAV: NavItem[] = [
  { href: "/", label: "nav.home", icon: GridIcon },
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
  },
  { href: "/members", label: "nav.members", icon: UsersIcon, description: "nav.membersHint" },
  {
    href: "/organizations",
    label: "nav.switchBand",
    icon: OrganizationIcon,
    description: "nav.switchBandHint",
  },
  { href: "/settings", label: "nav.settings", icon: SettingsIcon, description: "nav.settingsHint" },
]

/** True when `pathname` belongs to the nav entry (exact for tabs, prefix for details). */
export const isNavActive = (href: string, pathname: string): boolean => {
  if (href === "/") return pathname === "/"
  if (pathname === href) return true
  return pathname.startsWith(`${href}/`)
}

/**
 * Mobile tab index a pathname belongs to, or `-1` when it matches none.
 * Routes reachable from “More” count as the More tab, so switching from a
 * settings screen back to a tab animates as if the bar were the origin.
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
  /^\/songs\/new$/,
  /^\/songs\/[^/]+$/,
  /^\/songs\/[^/]+\/edit$/,
  /^\/songs\/[^/]+\/suggest$/,
  /^\/setlists\/new$/,
  /^\/setlists\/[^/]+\/edit$/,
  /^\/performances\/new$/,
  /^\/performances\/[^/]+\/edit$/,
]

export const isFocusRoute = (pathname: string): boolean =>
  FOCUS_ROUTES.some((pattern) => pattern.test(pathname))

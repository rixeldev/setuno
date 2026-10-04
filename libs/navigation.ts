import type { ComponentType } from "react"

import {
  CalendarIcon,
  ChatIcon,
  GridIcon,
  ListIcon,
  MusicIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/ui/Icons"

export interface NavItem {
  href: string
  label: string
  icon: ComponentType<{ size?: number; color?: string }>
  /** Hidden from the mobile bottom bar (still available in More / sidebar). */
  secondary?: boolean
  /** Only visible to organization admins. */
  adminOnly?: boolean
  /** Shows the pending suggestion counter. */
  badge?: "suggestions"
}

/** Desktop / web sidebar navigation (docs §18). */
export const SIDEBAR_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: GridIcon },
  { href: "/songs", label: "Songs", icon: MusicIcon },
  { href: "/setlists", label: "Setlists", icon: ListIcon },
  { href: "/performances", label: "Performances", icon: CalendarIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon, secondary: true },
  { href: "/suggestions", label: "Suggestions", icon: ChatIcon, badge: "suggestions" },
  { href: "/members", label: "Members", icon: UsersIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
]

/** Mobile bottom bar (docs §18): four primary destinations plus More. */
export const MOBILE_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: GridIcon },
  { href: "/songs", label: "Songs", icon: MusicIcon },
  { href: "/performances", label: "Gigs", icon: CalendarIcon },
  { href: "/setlists", label: "Setlists", icon: ListIcon },
  { href: "/more", label: "More", icon: SettingsIcon },
]

/** Everything reachable from the mobile “More” screen. */
export const MORE_NAV: NavItem[] = [
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/suggestions", label: "Suggestions", icon: ChatIcon, badge: "suggestions" },
  { href: "/members", label: "Members", icon: UsersIcon },
  { href: "/organizations", label: "Switch band", icon: UsersIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
]

/** True when `pathname` belongs to the nav entry (exact for tabs, prefix for details). */
export const isNavActive = (href: string, pathname: string): boolean => {
  if (href === "/") return pathname === "/"
  if (pathname === href) return true
  return pathname.startsWith(`${href}/`)
}

import { useCallback } from "react"
import { usePathname, useRouter } from "expo-router"

import { MOBILE_NAV, tabIndexFor } from "@/libs/navigation"

export interface TabNavigation {
  /** Moves to a bottom-bar tab, keeping the stack at [Home, currentTab]. */
  goToTab: (href: string) => void
}

/**
 * Bottom-bar navigation (docs §18): tab changes are instant (the tab roots are
 * registered with `animation: "none"`) and never leave the previous tab behind,
 * so the native back button from any tab root lands on the dashboard. Pushes
 * inside a tab keep the native stack transitions.
 */
export function useTabNavigation(): TabNavigation {
  const router = useRouter()
  const pathname = usePathname()

  const goToTab = useCallback(
    (href: string) => {
      const target = MOBILE_NAV.findIndex((item) => item.href === href)
      if (target === -1) return
      const current = tabIndexFor(pathname)
      // Tapping the tab you are on returns to its root when you are deeper
      // inside; tapping it at its root does nothing.
      if (target === current && pathname === href) return

      // Collapse whatever the previous tab left behind, then show the target.
      // `dismissAll` returns to the anchor (the dashboard); dispatching it with
      // nothing to dismiss logs an unhandled POP_TO_TOP warning, hence the
      // guard.
      if (router.canDismiss()) router.dismissAll()
      if (target !== 0) router.push(href as never)
    },
    [pathname, router],
  )

  return { goToTab }
}

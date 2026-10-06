import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "expo-router"

import { MOBILE_NAV, tabIndexFor } from "@/libs/navigation"
import { tabAnimation, tabDirection, type TabDirection } from "@/libs/tabNavigation"

interface TabTransitionValue {
  /** Native-stack animation for the tab roots, following the last tab change. */
  animation: "slide_from_right" | "slide_from_left"
  /** Moves to a bottom-bar tab, keeping the stack at [Home, currentTab]. */
  goToTab: (href: string) => void
}

const TabTransitionContext = createContext<TabTransitionValue | null>(null)

/**
 * The stack animation runs for 180 ms; after that margin new pushes default to
 * the rightward slide again (dashboard cards push tab roots too).
 */
const DIRECTION_RESET_MS = 420

/**
 * Bottom-bar transitions (docs §18): the stack never accumulates the visited
 * tabs — back from any tab root lands on the dashboard — and the slide follows
 * the tab order: to the right slides in from the right, and vice versa.
 */
export function TabTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [direction, setDirection] = useState<TabDirection>("right")
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    },
    [],
  )

  const goToTab = useCallback(
    (href: string) => {
      const target = MOBILE_NAV.findIndex((item) => item.href === href)
      if (target === -1) return
      const current = tabIndexFor(pathname)
      // Tapping the tab you are on returns to its root when you are deeper
      // inside; tapping it at its root does nothing.
      if (target === current && pathname === href) return

      setDirection(tabDirection(current, target))
      if (resetTimer.current) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setDirection("right"), DIRECTION_RESET_MS)

      // Collapse whatever the previous tab left behind, then push the target.
      // `dismissAll` returns to the anchor (the dashboard), so the native back
      // button never walks the pile of visited tab screens.
      router.dismissAll()
      if (target !== 0) router.push(href as never)
    },
    [pathname, router],
  )

  const value = useMemo<TabTransitionValue>(
    () => ({ animation: tabAnimation(direction), goToTab }),
    [direction, goToTab],
  )

  return <TabTransitionContext.Provider value={value}>{children}</TabTransitionContext.Provider>
}

export function useTabTransition(): TabTransitionValue {
  const context = useContext(TabTransitionContext)
  if (!context) throw new Error("useTabTransition must be used inside a TabTransitionProvider")
  return context
}

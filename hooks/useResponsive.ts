import { Platform, useWindowDimensions } from "react-native"

import { breakpoints, Theme } from "@/constants/Theme"
import { isTabletViewport } from "@/libs/deviceClass"

export interface Responsive {
  width: number
  height: number
  /** Phone layout: bottom navigation, single column. */
  isMobile: boolean
  /** Tablet: two column grids, compact sidebar. */
  isTablet: boolean
  /** Desktop: full sidebar navigation (web + large tablets). */
  isDesktop: boolean
  /** Native tablet (iPad / Android sw600dp): the only class that rotates. */
  isTabletDevice: boolean
  /** Whether the device is held horizontally (width > height). */
  isLandscape: boolean
  /** Sidebar navigation instead of the bottom bar. */
  usesSidebar: boolean
  /** Horizontal page padding for the current breakpoint. */
  gutter: number
  /** Max readable content width (keeps long lines comfortable). */
  contentMaxWidth: number
  /** Body width available after the sidebar (if any) and page gutters. */
  contentWidth: number
}

/**
 * Single source of truth for responsive behaviour so every screen adapts the
 * same way on Android and Web (docs §4, §21).
 *
 * Tablets only gain the wide (sidebar) layout while in landscape, so a portrait
 * tablet keeps the phone-style bottom bar and a single reading column stays
 * readable.
 */
export const useResponsive = (): Responsive => {
  const { width, height } = useWindowDimensions()
  const isDesktop = width >= breakpoints.desktop
  const isTablet = width >= breakpoints.tablet && !isDesktop
  const isMobile = width < breakpoints.tablet
  const isTabletDevice = Platform.OS !== "web" && isTabletViewport(width, height)
  const isLandscape = width > height
  const usesSidebar = isDesktop || (isTabletDevice && isLandscape)

  const gutter = isDesktop ? 32 : isTablet ? 24 : 16
  const contentMaxWidth = isDesktop ? 1080 : isTablet ? 900 : 720
  const sidebarWidth = usesSidebar ? Theme.layout.sidebarWidth : 0
  const contentWidth = Math.max(0, Math.min(contentMaxWidth, width - gutter * 2 - sidebarWidth))

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    isTabletDevice,
    isLandscape,
    usesSidebar,
    gutter,
    contentMaxWidth,
    contentWidth,
  }
}

/** Columns for responsive card grids. */
export const useGridColumns = (minWidth = 280): number => {
  const { width, gutter } = useResponsive()
  const available = Math.max(minWidth, width - gutter * 2)
  const columns = Math.floor(available / minWidth)
  return Math.max(1, Math.min(columns, 4))
}

/** Number of columns used by compact stat/filter rows. */
export const useCompactColumns = (minWidth = 150): number => {
  const { width, gutter } = useResponsive()
  const columns = Math.floor(Math.max(minWidth, width - gutter * 2) / minWidth)
  return Math.max(2, Math.min(columns, 5))
}
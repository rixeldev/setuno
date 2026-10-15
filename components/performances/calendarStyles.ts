import { StyleSheet } from "react-native"

import { Theme } from "@/constants/Theme"

/**
 * The chrome both calendar grids draw (roadmap #51): a header with two
 * navigation buttons, a row of weekday labels and the cells below. Extracted so
 * the month grid and the week strip stay pixel-identical — two copies of this
 * would drift the first time either was nudged.
 */
export const calendarChromeStyles = () =>
  StyleSheet.create({
    host: { gap: Theme.spacing.s },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.s,
    },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: Theme.radii.s,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.background2,
    },
    weekRow: { flexDirection: "row" },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    cellLabel: { width: `${100 / 7}%`, textAlign: "center" },
    pressed: { opacity: 0.7 },
  })

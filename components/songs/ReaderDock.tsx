import React, { useEffect, useState } from "react"
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useResponsive } from "@/hooks/useResponsive"
import { AppText } from "@/components/ui/AppText"
import { IconButton } from "@/components/ui/Button"
import { ChevronUpIcon, FullscreenIcon, MusicIcon, PauseIcon, PlayFilledIcon } from "@/components/ui/Icons"

/**
 * Height of the shut dock. The reader's bottom padding and the corner arrows
 * key off it, so they cannot end up underneath the tray.
 */
export const READER_DOCK_HEIGHT = 46

/** One duration for the panel: slow enough to read, short enough to feel direct. */
const PANEL_MS = 240

interface ReaderDockProps {
  /** True while the full control panel is open. */
  open: boolean
  onToggle: () => void
  /** `G · Capo 3` — the tuning at a glance; tapping it toggles the panel. */
  summary: string
  summaryAccessibilityLabel: string
  /** Autoscroll transport, shown only while the panel is shut (the open panel carries its own). */
  autoscrollRunning: boolean
  autoscrollDisabled: boolean
  autoscrollLabel: string
  /** 0..1 travelled, drawn as a hairline on the tray's leading edge (`null`: idle). */
  autoscrollProgress: number | null
  onAutoscrollToggle: () => void
  stageLabel: string
  onStage: () => void
  /** The full controls (`SongControls` + `AutoscrollBar`). Always passed: the panel stays mounted so its height is known before the first tap. */
  children?: React.ReactNode
}

/**
 * The reader's control tray (redesign of the song screen): a single row pinned
 * to the bottom that replaces the stack of header, transpose panel and
 * autoscroll bar that used to sit above the lyrics.
 *
 * It is deliberately **not** a floating card. It shares the tab bar's `chrome`
 * surface and is separated from the song by one hairline, so the controls read
 * as the continuation of the bottom navigation instead of a box dropped over
 * the lyrics — the rounded, shadowed card this replaces looked like exactly
 * that. `AppShell` already leaves the screen above the tab bar and banner, so
 * `bottom: 0` lands in the right place on every platform without consulting
 * the bottom chrome.
 *
 * Shut, it costs one `READER_DOCK_HEIGHT` row and keeps only what reading
 * needs — play the scroll, see the tuning, go fullscreen, open the rest. Open,
 * the panel grows upward over the lyrics with everything else, animated by the
 * same value that turns the chevron, so the two can never drift apart.
 */
export function ReaderDock({
  open,
  onToggle,
  summary,
  summaryAccessibilityLabel,
  autoscrollRunning,
  autoscrollDisabled,
  autoscrollLabel,
  autoscrollProgress,
  onAutoscrollToggle,
  stageLabel,
  onStage,
  children,
}: ReaderDockProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { gutter, contentMaxWidth } = useResponsive()

  // Created once through the lazy initializer: a module-level value would be
  // shared by every reader on screen.
  const openProgress = useState(() => new Animated.Value(0))[0]
  const [panelHeight, setPanelHeight] = useState(0)

  useEffect(() => {
    Animated.timing(openProgress, {
      toValue: open ? 1 : 0,
      duration: PANEL_MS,
      easing: Easing.out(Easing.cubic),
      // Height cannot be driven from the native thread, so everything the same
      // value touches (the chevron included) stays on the JS driver.
      useNativeDriver: false,
    }).start()
  }, [open, openProgress])

  // The hairline alone says the transport is alive and how far it has gone;
  // open, the full bar shows both, so repeating them would be the same
  // information twice on screen. The summary never carries the readout: it
  // must not truncate the tuning away on a narrow phone.
  // The template type matters: widened to `string` this no longer satisfies
  // React Native's `DimensionValue`, and the style stops type-checking.
  const trackFill: `${number}%` | null =
    !open && autoscrollProgress !== null
      ? `${Math.round(Math.min(1, Math.max(0, autoscrollProgress)) * 100)}%`
      : null

  return (
    <View style={styles.host}>
      {trackFill === null ? null : (
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: trackFill }]} />
        </View>
      )}

      <Animated.View
        style={[
          styles.panelClip,
          { height: interpolateHeight(openProgress, panelHeight) },
          // `pointerEvents` belongs in `style` (the prop is deprecated).
          !open ? styles.panelHidden : null,
        ]}
        // Clipped to nothing but still mounted, so `onLayout` already knows the
        // height the first time the tray is opened. Hidden from both the touch
        // system and the accessibility tree while shut.
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? "auto" : "no-hide-descendants"}
        aria-hidden={!open}
      >
        <View
          style={styles.panel}
          onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
        >
          {children}
        </View>
      </Animated.View>

      <Animated.View style={[styles.divider, { opacity: openProgress }]} />

      <View style={[styles.row, { paddingHorizontal: gutter, maxWidth: contentMaxWidth }]}>
        {open ? null : (
          <IconButton
            label={autoscrollLabel}
            variant="secondary"
            size={36}
            disabled={autoscrollDisabled}
            onPress={onAutoscrollToggle}
            icon={
              autoscrollRunning ? (
                <PauseIcon size={16} color={Theme.colors.primary} />
              ) : (
                <PlayFilledIcon size={16} color={Theme.colors.primary} />
              )
            }
          />
        )}

        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={summaryAccessibilityLabel}
          style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
        >
          <MusicIcon size={15} color={Theme.colors.primary} />
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.summaryText}>
            {summary}
          </AppText>
        </Pressable>

        <IconButton
          label={stageLabel}
          variant="ghost"
          size={36}
          onPress={onStage}
          icon={<FullscreenIcon size={17} color={Theme.colors.textMuted} />}
        />
        <IconButton
          label={open ? t("songs.hideControls") : t("songs.showControls")}
          variant="ghost"
          size={36}
          onPress={onToggle}
          icon={
            <Animated.View style={{ transform: [{ rotate: interpolateRotation(openProgress) }] }}>
              <ChevronUpIcon size={17} color={Theme.colors.textMuted} />
            </Animated.View>
          }
        />
      </View>
    </View>
  )
}

const interpolateHeight = (progress: Animated.Value, height: number) =>
  progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] })

const interpolateRotation = (progress: Animated.Value) =>
  progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] })

const createStyles = () =>
  StyleSheet.create({
    // Continues the bottom navigation instead of floating over it.
    host: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: Theme.colors.chrome,
      borderTopWidth: 1,
      borderTopColor: Theme.colors.borderSoft,
      paddingBottom: Theme.spacing.xxs,
    },
    panelClip: { overflow: "hidden" },
    panelHidden: { pointerEvents: "none" },
    // `SongControls` and `AutoscrollBar` bring their own gutter and max width,
    // exactly as they did at the top of the screen, so the panel adds none.
    panel: {
      paddingTop: Theme.spacing.xs,
      paddingBottom: Theme.spacing.xs,
    },
    divider: { height: 1, backgroundColor: Theme.colors.borderSoft },
    // Hairline of autoscroll progress on the tray's leading edge: it says the
    // transport is alive without spending a row on it.
    track: {
      height: 2,
      backgroundColor: Theme.colors.borderSoft,
      overflow: "hidden",
    },
    trackFill: { height: "100%", backgroundColor: Theme.colors.primary },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.xs,
      width: "100%",
      minHeight: READER_DOCK_HEIGHT,
      paddingVertical: 5,
    },
    summary: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flex: 1,
      minWidth: 0,
      paddingVertical: 6,
      paddingHorizontal: Theme.spacing.m,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.surface,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
    },
    summaryText: { flexShrink: 1 },
    pressed: { opacity: 0.7 },
  })

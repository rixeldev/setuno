import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useResponsive } from "@/hooks/useResponsive"
import { AppText, type TextTone } from "@/components/ui/AppText"
import { IconButton } from "@/components/ui/Button"
import { ArrowUpwardIcon, PauseIcon, PlayFilledIcon } from "@/components/ui/Icons"
import {
  AUTOSCROLL_MAX_SPEED,
  AUTOSCROLL_MIN_SPEED,
  AUTOSCROLL_SPEED_STEP,
  clampAutoscrollSpeed,
  nextAutoscrollDelay,
  autoscrollStatusText,
  type AutoscrollDelay,
  type AutoscrollStatus,
} from "@/libs/autoscroll"

interface AutoscrollBarProps {
  status: AutoscrollStatus
  /** Seconds left of the start countdown. */
  countdown: number
  /** 0..1 of the scrollable range already travelled. */
  progress: number
  /** Seconds left at the current speed (`null` while unknown). */
  remainingSeconds: number | null
  /** False when the lyrics already fit on screen: nothing to scroll. */
  canScroll: boolean
  speed: number
  onSpeedChange: (speed: number) => void
  delay: number
  onDelayChange: (delay: AutoscrollDelay) => void
  onToggle: () => void
  /** Rewinds the readout and stops the transport. */
  onReset: () => void
}

const STEP_SIZE = 28

const STATUS_TONE: Record<AutoscrollStatus, TextTone> = {
  idle: "muted",
  waiting: "primary",
  playing: "primary",
  paused: "muted",
  done: "success",
}

/**
 * Autoscroll transport of the song reader (roadmap #1): play/pause, speed in
 * lyric lines per minute, a start delay and a progress readout. Speed and delay
 * are remembered per song and per user; the transport itself is per session.
 */
export function AutoscrollBar({
  status,
  countdown,
  progress,
  remainingSeconds,
  canScroll,
  speed,
  onSpeedChange,
  delay,
  onDelayChange,
  onToggle,
  onReset,
}: AutoscrollBarProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { gutter, contentMaxWidth } = useResponsive()

  const running = status === "playing" || status === "waiting"
  const transportLabel = running
    ? t("songs.autoscrollPause")
    : status === "paused"
      ? t("songs.autoscrollResume")
      : t("songs.autoscrollPlay")

  const statusText =
    autoscrollStatusText(status, countdown, remainingSeconds, t) ?? t("songs.autoscroll")

  const delayLabel =
    delay === 0 ? t("songs.autoscrollDelayNone") : t("songs.autoscrollDelaySeconds", { seconds: delay })

  return (
    <View style={[styles.host, { paddingHorizontal: gutter }]}>
      <View style={[styles.inner, { maxWidth: contentMaxWidth }]}>
        <View style={styles.row}>
          <IconButton
            label={transportLabel}
            variant="secondary"
            size={40}
            disabled={!canScroll && !running}
            onPress={onToggle}
            icon={
              running ? (
                <PauseIcon size={18} color={Theme.colors.primary} />
              ) : (
                <PlayFilledIcon size={18} color={Theme.colors.primary} />
              )
            }
          />

          <View style={styles.info}>
            <AppText variant="label" tone="faint" numberOfLines={1}>
              {t("songs.autoscroll")}
            </AppText>
            <AppText variant="bodyStrong" tone={STATUS_TONE[status]} numberOfLines={1}>
              {statusText}
            </AppText>
          </View>

          <IconButton
            label={t("songs.autoscrollReset")}
            variant="ghost"
            size={STEP_SIZE}
            disabled={!canScroll || progress <= 0}
            onPress={onReset}
            icon={<ArrowUpwardIcon size={16} color={Theme.colors.textMuted} />}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.speedGroup}>
            <AppText variant="caption" tone="faint" numberOfLines={1} style={styles.shrink}>
              {t("songs.autoscrollSpeed")}
            </AppText>
            <View style={styles.stepper}>
              <IconButton
                label={t("songs.autoscrollSlower")}
                variant="secondary"
                size={STEP_SIZE}
                disabled={speed <= AUTOSCROLL_MIN_SPEED}
                onPress={() => onSpeedChange(clampAutoscrollSpeed(speed - AUTOSCROLL_SPEED_STEP))}
                icon={<AppText variant="bodyStrong">−</AppText>}
              />
              <AppText variant="caption" tone="muted" style={styles.speedValue}>
                {speed}
              </AppText>
              <IconButton
                label={t("songs.autoscrollFaster")}
                variant="secondary"
                size={STEP_SIZE}
                disabled={speed >= AUTOSCROLL_MAX_SPEED}
                onPress={() => onSpeedChange(clampAutoscrollSpeed(speed + AUTOSCROLL_SPEED_STEP))}
                icon={<AppText variant="bodyStrong">+</AppText>}
              />
            </View>
            <AppText variant="caption" tone="faint" numberOfLines={1} style={styles.shrink}>
              {t("songs.autoscrollSpeedUnit")}
            </AppText>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("songs.autoscrollDelayA11y", { seconds: delay })}
            onPress={() => onDelayChange(nextAutoscrollDelay(delay))}
            style={({ pressed }) => [styles.delayChip, pressed && styles.pressed]}
          >
            <AppText variant="caption" tone="faint" numberOfLines={1}>
              {t("songs.autoscrollDelay")}
            </AppText>
            <AppText variant="bodyStrong" tone="primary" numberOfLines={1}>
              {delayLabel}
            </AppText>
          </Pressable>
        </View>

        {canScroll ? (
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
          >
            <View style={[styles.trackFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        ) : null}
      </View>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    // No surface and no rules of its own: it renders inside the reader's bottom
    // tray, which paints the chrome and the divider.
    host: { paddingVertical: Theme.spacing.xs },
    inner: { width: "100%", alignSelf: "center", gap: Theme.spacing.xs },
    row: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    info: { flex: 1, minWidth: 0, gap: 2 },
    speedGroup: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
    },
    shrink: { flexShrink: 1 },
    stepper: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.xs },
    speedValue: { minWidth: 20, textAlign: "center" },
    delayChip: {
      alignItems: "center",
      gap: 2,
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: 5,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: Theme.colors.primary,
    },
    pressed: { opacity: 0.7 },
    track: {
      height: 3,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.surfaceMuted,
      overflow: "hidden",
    },
    trackFill: {
      height: "100%",
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.primary,
    },
  })

import React, { useEffect, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { IconButton } from "@/components/ui/Button"
import { BottomSheet, SheetOptionRow } from "@/components/ui/BottomSheet"
import {
  CheckCircleIcon,
  PauseIcon,
  PlayFilledIcon,
  StopwatchIcon,
  TargetIcon,
} from "@/components/ui/Icons"
import { ShowOutcomeSheet } from "@/components/performances/ShowOutcomeSheet"
import {
  useLiveShow,
  startLiveShow,
  stopLiveShow,
  startBreak,
  endBreak,
  markShowSong,
} from "@/hooks/useReaderSession"
import { breakRemainingSec, formatClock, liveProgressRatio, scheduleDeltaSec } from "@/libs/liveShow"
import { showEntryFor } from "@/libs/showLog"
import { SHOW_OUTCOME_KEYS } from "@/interfaces/performance"
import type { LiveSetEntry } from "@/libs/liveShow"
import type { ShowLogEntry } from "@/interfaces/performance"

interface LiveShowBarProps {
  /** Setlist being played; must match the one the show was started from. */
  setlistId: string
  /** Running order enriched with durations. */
  entries: LiveSetEntry[]
  /** Index of the song currently on screen. */
  index: number
  /** Estimated duration of the whole set, seconds. */
  estimatedSec: number
  /** The event's stored log, seeded into the session when the show starts. */
  seedLog: readonly ShowLogEntry[]
}

/** Break lengths offered in the picker, in minutes. */
const BREAK_MINUTES = [5, 10, 15, 20]

/**
 * Live show strip (roadmap #7): where the band is in the running order, how far
 * ahead or behind the estimate it is, a peek at the next song and a break
 * countdown. The clock lives in `hooks/useReaderSession.ts` (in memory), so it
 * survives stepping from song to song; since roadmap #45 the same session also
 * carries the show **log** — marks and measured seconds — which the reader
 * persists to the event through `useShowLogSync`. The strip never writes to
 * Firestore itself: it only talks to the session store.
 *
 * It is a **strip**, not a panel. The reader's job is the song, so this is one
 * row of captions plus its icon actions, painted straight onto the reader's own
 * background with a single hairline under it — break and stop while the show
 * runs, and since #45 a third (mark, tinted by the song's outcome) whose sheet
 * is the only thing that ever opens over it. Everything that used to justify a
 * second row is folded in or dropped: the labelled stats block is now inline
 * captions, and the estimate and remaining time are gone — the delta already
 * tells the band whether it is running late, which is the only thing either of
 * them would change.
 *
 * **The row never carries two numbers at once**: the position, then the delta
 * — and the elapsed clock only while the set is on time, when there is room to
 * spare for it. That is what keeps `next` from truncating on a narrow phone,
 * which is why `position` is the `3/8` form and the delta reads `3:00 late`
 * rather than the longer phrasings these keys used to hold.
 *
 * Roughly a third of the height it used to take, in both modes (the `compact`
 * prop is gone: stage mode gets the same strip).
 */
export function LiveShowBar({
  setlistId,
  entries,
  index,
  estimatedSec,
  seedLog,
}: LiveShowBarProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const show = useLiveShow()

  const running = show.setlistId === setlistId && show.startedAt !== null
  // A break only belongs to the show it was started in.
  const showBreak = running ? show.breakUntil : null
  const ticking = running || showBreak !== null

  // One shared seconds clock: the strip is the only thing that needs a timer,
  // so it lives here instead of re-rendering the reader every second.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [ticking])

  const [breakOpen, setBreakOpen] = useState(false)
  const [markOpen, setMarkOpen] = useState(false)

  const breakLeft = breakRemainingSec(showBreak, now)
  const elapsedSec = running && show.startedAt ? (now - show.startedAt) / 1000 : 0
  const delta = scheduleDeltaSec(elapsedSec, estimatedSec)
  const nextEntry = index >= 0 ? (entries[index + 1] ?? null) : null
  const currentEntry = index >= 0 ? showEntryFor(show.log, entries[index]?.songId ?? "") : null
  const total = entries.length
  const ratio = liveProgressRatio(index, total)
  const onBreak = showBreak !== null && breakLeft > 0
  const breakOver = showBreak !== null && breakLeft <= 0

  const startLabel = t("liveShow.start")

  const start = (): void => {
    // Seeded from the event's stored log (the report's marks survive) and the
    // first song starts its clock right away (#45).
    startLiveShow(setlistId, { seed: seedLog, firstSongId: entries[index]?.songId ?? null })
    setNow(Date.now())
  }

  const stop = (): void => stopLiveShow()

  const pickBreak = (minutes: number): void => {
    startBreak(minutes * 60)
    setBreakOpen(false)
  }

  // The delta is the one number the band acts on, so it is the only thing in
  // the row that carries a colour: late is danger, early is primary, and on
  // time costs no space at all.
  const deltaText =
    delta === null
      ? null
      : delta > 0
        ? t("liveShow.behind", { time: formatClock(delta) })
        : t("liveShow.ahead", { time: formatClock(-delta) })

  return (
    <View style={styles.host}>
      {total > 0 ? (
        <View style={styles.track} accessibilityElementsHidden>
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
        </View>
      ) : null}

      <View style={styles.row}>
        <StopwatchIcon size={14} color={Theme.colors.primary} />

        {running ? (
          <>
            <AppText variant="caption" tone="primary" numberOfLines={1}>
              {t("liveShow.position", { current: index + 1, total })}
            </AppText>

            {/* One number next to the position, never two: the delta when there
                is one, because it is the one the band acts on — the elapsed
                clock only shows while the set is on time and the row has room
                to spare for it. */}
            {deltaText ? (
              <AppText
                variant="caption"
                tone={delta !== null && delta > 0 ? "danger" : "primary"}
                numberOfLines={1}
              >
                {deltaText}
              </AppText>
            ) : (
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {formatClock(elapsedSec)}
              </AppText>
            )}
          </>
        ) : (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {t("liveShow.title")}
          </AppText>
        )}

        {/* First to go when the row gets tight: the actions and the numbers
            are the reason the strip exists. */}
        <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
          {nextEntry
            ? t("liveShow.next", { title: nextEntry.title })
            : running
              ? t("liveShow.lastSong")
              : t("liveShow.ready")}
        </AppText>

        {onBreak || breakOver ? (
          <Pressable
            onPress={() => endBreak()}
            accessibilityRole="button"
            accessibilityLabel={t("liveShow.endBreakA11y")}
            style={({ pressed }) => [styles.breakChip, pressed && styles.pressed]}
          >
            {onBreak ? (
              <AppText variant="caption" tone="primary">
                {t("liveShow.onBreak", { time: formatClock(breakLeft) })}
              </AppText>
            ) : (
              <View style={styles.breakOverRow}>
                <CheckCircleIcon size={13} color={Theme.colors.primary} />
                <AppText variant="caption" tone="primary">
                  {t("liveShow.breakOver")}
                </AppText>
              </View>
            )}
          </Pressable>
        ) : (
          <IconButton
            label={t("liveShow.startBreakA11y")}
            variant="ghost"
            size={30}
            disabled={!running}
            onPress={() => setBreakOpen(true)}
            icon={<StopwatchIcon size={15} color={Theme.colors.textMuted} />}
          />
        )}

        {/* Roadmap #45: mark how the song on the clock went — tinted by the
            mark already set (skipped = danger, improvised = accent) so the
            strip shows it without spending a caption on it. */}
        {running ? (
          <IconButton
            label={
              currentEntry
                ? `${t("liveShow.markA11y")} · ${t(SHOW_OUTCOME_KEYS[currentEntry.outcome])}`
                : t("liveShow.markA11y")
            }
            variant="ghost"
            size={30}
            onPress={() => setMarkOpen(true)}
            icon={
              <TargetIcon
                size={15}
                color={
                  currentEntry?.outcome === "skipped"
                    ? Theme.colors.danger
                    : currentEntry?.outcome === "improvised"
                      ? Theme.colors.accent
                      : Theme.colors.textMuted
                }
              />
            }
          />
        ) : null}

        {running ? (
          <IconButton
            label={t("liveShow.stop")}
            variant="ghost"
            size={30}
            onPress={stop}
            icon={<PauseIcon size={15} color={Theme.colors.textMuted} />}
          />
        ) : (
          <IconButton
            label={startLabel}
            variant="secondary"
            size={30}
            onPress={start}
            icon={<PlayFilledIcon size={15} color={Theme.colors.primary} />}
          />
        )}
      </View>

      <ShowOutcomeSheet
        visible={markOpen}
        onClose={() => setMarkOpen(false)}
        songTitle={entries[index]?.title ?? ""}
        outcome={currentEntry?.outcome ?? null}
        onSelect={(outcome) => markShowSong(setlistId, outcome)}
      />

      <BottomSheet
        visible={breakOpen}
        onClose={() => setBreakOpen(false)}
        title={t("liveShow.breakTitle")}
        subtitle={t("liveShow.breakSubtitle")}
      >
        {BREAK_MINUTES.map((minutes) => (
          <SheetOptionRow
            key={minutes}
            label={t("liveShow.breakMinutes", { count: minutes })}
            onPress={() => pickBreak(minutes)}
          />
        ))}
      </BottomSheet>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    // A strip on the song's own surface, not a panel of its own: one hairline
    // below is all the separation it gets.
    host: {
      backgroundColor: Theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: Theme.colors.borderSoft,
    },
    // Rides the strip's top edge so the row keeps the whole height budget.
    track: { height: 2, backgroundColor: Theme.colors.borderSoft, overflow: "hidden" },
    fill: { height: "100%", backgroundColor: Theme.colors.primary },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: Theme.spacing.xs,
    },
    flex: { flex: 1, minWidth: 0 },
    breakChip: {
      paddingHorizontal: Theme.spacing.s,
      paddingVertical: 3,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: Theme.colors.primary,
    },
    breakOverRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    pressed: { opacity: 0.7 },
  })

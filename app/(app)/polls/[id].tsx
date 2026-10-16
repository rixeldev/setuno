import React, { useMemo, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Card, Chip } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState, Skeleton } from "@/components/ui/States"
import { useToast } from "@/components/ui/Toast"
import { ModalScreen } from "@/components/app/ModalScreen"
import { CalendarIcon, CheckCircleIcon, TrashIcon } from "@/components/ui/Icons"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { usePoll, usePollVotes } from "@/hooks/useDatePolls"
import { closePoll, deletePoll, markPollEventCreated, saveMyVote } from "@/services/datePolls"
import { createPerformance } from "@/services/performances"
import { toFriendlyError } from "@/services/errors"
import { pollWinner, sortPollOptions, toggleOption, votersForOption } from "@/libs/datePolls"
import { formatDateRange, formatTime } from "@/libs/format"
import type { DatePollOption, PerformanceInput } from "@/interfaces"

/**
 * One date poll (roadmap #48): everyone ticks the dates they can make, an
 * admin closes it on the winner and turns that date into a real event. The
 * tally, the tie-break and the "no votes = no winner" rule live in pure
 * `libs/datePolls.ts#pollWinner` — this screen only renders them.
 */
export default function PollDetail() {
  const styles = useThemedStyles(createStyles)
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const params = useLocalSearchParams<{ id?: string }>()
  const pollId = params.id ?? null

  const { profile } = useAuth()
  const { organizationId, isAdmin } = useOrganization()
  const { members } = useOrgData()
  const { poll, loading } = usePoll(organizationId, pollId)
  const { votes } = usePollVotes(organizationId, pollId)

  const [busy, setBusy] = useState<"vote" | "close" | "event" | "delete" | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const options = useMemo(
    () => (poll ? sortPollOptions(poll.options) : []),
    [poll],
  )
  const winner = useMemo(
    () => (poll && poll.winningOptionId
      ? options.find((option) => option.id === poll.winningOptionId) ?? null
      : null),
    [options, poll],
  )
  const myIds = useMemo(
    () => votes.find((vote) => vote.uid === profile?.uid)?.optionIds ?? [],
    [votes, profile],
  )

  const dateLabel = (option: DatePollOption): string =>
    formatDateRange(option.date, null, i18n.language)
  const labelWithTime = (option: DatePollOption): string =>
    option.time ? `${dateLabel(option)} · ${formatTime(option.time)}` : dateLabel(option)
  const nameOf = (uid: string): string =>
    members.find((member) => member.uid === uid)?.displayName ?? uid.slice(0, 8)

  const canDelete = Boolean(poll && (isAdmin || (profile && poll.createdBy === profile.uid)))

  const toggleVote = async (optionId: string): Promise<void> => {
    if (!poll) return
    setBusy("vote")
    try {
      await saveMyVote(organizationId ?? "", poll.id, toggleOption(myIds, optionId))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("polls.couldNotVote")))
    } finally {
      setBusy(null)
    }
  }

  const close = async (): Promise<void> => {
    if (!poll) return
    setConfirmClose(false)
    setBusy("close")
    try {
      // The winner is **computed here** from the live votes — `winningOptionId`
      // is only stamped by this very write, so reading it would always close
      // the poll empty-handed.
      const elected = pollWinner(poll.options, votes)
      await closePoll(organizationId ?? "", poll.id, elected?.id ?? "")
      toast.showSuccess(elected ? t("polls.closedWithWinner") : t("polls.closedWithoutVotes"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("polls.couldNotClose")))
    } finally {
      setBusy(null)
    }
  }

  const createEvent = async (): Promise<void> => {
    if (!poll || !winner || !profile) return
    setBusy("event")
    try {
      // The winner's date and time seed a scheduled gig; the venue and the
      // setlists are the event form's job afterwards.
      const input: PerformanceInput = {
        name: poll.title,
        date: winner.date,
        endDate: null,
        startTime: winner.time,
        endTime: "",
        venue: { name: "", address: "", notes: "" },
        notes: "",
        setlists: [],
        status: "scheduled",
        type: "gig",
      }
      const id = await createPerformance(organizationId ?? "", input, {
        id: profile.uid,
        name: profile.displayName || "An admin",
      })
      await markPollEventCreated(organizationId ?? "", poll.id, id)
      toast.showSuccess(t("polls.eventCreated"))
      router.replace(`/performances/${id}`)
    } catch (error) {
      toast.showError(toFriendlyError(error, t("polls.couldNotCreateEvent")))
    } finally {
      setBusy(null)
    }
  }

  const remove = async (): Promise<void> => {
    if (!poll) return
    setConfirmDelete(false)
    setBusy("delete")
    try {
      await deletePoll(organizationId ?? "", poll.id)
      toast.showSuccess(t("polls.pollDeleted"))
      router.back()
    } catch (error) {
      toast.showError(toFriendlyError(error, t("polls.couldNotDelete")))
    } finally {
      setBusy(null)
    }
  }

  if (!pollId || (!poll && !loading)) {
    return (
      <ModalScreen title={t("polls.title")}>
        <EmptyState title={t("polls.notFound")} message={t("polls.notFoundHint")} />
      </ModalScreen>
    )
  }

  return (
    <ModalScreen
      title={poll ? poll.title : t("polls.title")}
      headerRight={
        canDelete && poll ? (
          <IconButton
            icon={<TrashIcon size={18} color={Theme.colors.danger} />}
            onPress={() => setConfirmDelete(true)}
            label={t("polls.deletePoll")}
          />
        ) : null
      }
    >
      {loading || !poll ? <Skeleton height={260} /> : null}

      {poll ? (
        <>
          <View style={styles.statusRow}>
            <Chip
              size="sm"
              label={poll.status === "open" ? t("polls.open") : t("polls.closed")}
              tone={poll.status === "open" ? "primary" : "default"}
            />
            {poll.status === "open" ? (
              <AppText variant="caption" tone="muted">
                {t("polls.voteHint")}
              </AppText>
            ) : null}
          </View>

          {poll.status === "closed" ? (
            <Card style={styles.winnerCard}>
              <AppText variant="bodyStrong" tone={winner ? "primary" : "muted"}>
                {winner
                  ? t("polls.winner", { date: labelWithTime(winner) })
                  : t("polls.winnerNone")}
              </AppText>
            </Card>
          ) : null}

          <Card style={styles.options}>
            {options.map((option) => {
              const voterNames = votersForOption(votes, option.id)
              const mine = myIds.includes(option.id)
              const isWinner = poll.winningOptionId === option.id
              const open = poll.status === "open"
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole={open ? "checkbox" : "text"}
                  accessibilityState={{ checked: mine, disabled: !open || busy === "vote" }}
                  accessibilityLabel={`${labelWithTime(option)}, ${t("polls.voters", {
                    count: voterNames.length,
                  })}`}
                  disabled={!open || busy === "vote"}
                  onPress={() => void toggleVote(option.id)}
                  style={({ pressed }) => [
                    styles.option,
                    isWinner && styles.optionWinner,
                    pressed && open ? styles.pressed : null,
                  ]}
                >
                  <View style={styles.tick}>
                    {mine ? (
                      <CheckCircleIcon size={22} color={Theme.colors.primary} />
                    ) : (
                      <View style={styles.tickEmpty} />
                    )}
                  </View>
                  <View style={styles.optionBody}>
                    <AppText variant={isWinner ? "bodyStrong" : "body"}>
                      {labelWithTime(option)}
                    </AppText>
                    {option.note ? (
                      <AppText variant="caption" tone="faint" numberOfLines={2}>
                        {option.note}
                      </AppText>
                    ) : null}
                    <AppText variant="caption" tone={voterNames.length > 0 ? "muted" : "faint"}>
                      {voterNames.length > 0
                        ? voterNames.map(nameOf).join(", ")
                        : t("polls.noVoters")}
                    </AppText>
                  </View>
                  {isWinner ? (
                    <Chip size="sm" label={t("polls.winnerChip")} tone="success" selected />
                  ) : (
                    <Chip
                      size="sm"
                      label={t("polls.voters", { count: voterNames.length })}
                      tone={voterNames.length > 0 ? "primary" : "default"}
                    />
                  )}
                </Pressable>
              )
            })}
          </Card>

          {poll.status === "closed" && poll.winningOptionId && !poll.createdEventId && !isAdmin ? (
            <AppText variant="caption" tone="faint">
              {t("polls.adminCreatesHint")}
            </AppText>
          ) : null}

          <View style={styles.actions}>
            {isAdmin && poll.status === "open" ? (
              <Button
                label={t("polls.closePoll")}
                variant="secondary"
                full
                disabled={busy === "close"}
                loading={busy === "close"}
                onPress={() => setConfirmClose(true)}
              />
            ) : null}

            {poll.status === "closed" && poll.createdEventId ? (
              <Button
                label={t("polls.openEvent")}
                variant="secondary"
                full
                icon={<CalendarIcon size={16} color={Theme.colors.text} />}
                onPress={() => router.push(`/performances/${poll.createdEventId}`)}
              />
            ) : null}

            {poll.status === "closed" && winner && !poll.createdEventId && isAdmin ? (
              <Button
                label={t("polls.createEvent")}
                full
                disabled={busy === "event"}
                loading={busy === "event"}
                icon={<CalendarIcon size={16} color={Theme.colors.onPrimary} />}
                onPress={() => void createEvent()}
              />
            ) : null}
          </View>

          <Dialog
            visible={confirmClose}
            onClose={() => setConfirmClose(false)}
            title={t("polls.closeConfirm")}
            description={t("polls.closeDescription")}
            confirmLabel={t("polls.closePoll")}
            onConfirm={() => void close()}
          />

          <Dialog
            visible={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            tone="danger"
            title={t("polls.deleteConfirm", { title: poll.title })}
            description={t("polls.deleteDescription")}
            confirmLabel={t("common.delete")}
            onConfirm={() => void remove()}
          />
        </>
      ) : null}
    </ModalScreen>
  )
}

const createStyles = () =>
  StyleSheet.create({
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      flexWrap: "wrap",
    },
    winnerCard: { gap: Theme.spacing.xs },
    options: { gap: Theme.spacing.s },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      padding: Theme.spacing.s,
      borderRadius: Theme.radii.m,
      borderWidth: 1,
      borderColor: "transparent",
    },
    optionWinner: {
      borderColor: Theme.colors.primary,
      backgroundColor: Theme.colors.primarySoft,
    },
    tick: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
    tickEmpty: {
      width: 20,
      height: 20,
      borderRadius: Theme.radii.pill,
      borderWidth: 1.5,
      borderColor: Theme.colors.border,
    },
    optionBody: { flex: 1, minWidth: 0, gap: 2 },
    actions: { gap: Theme.spacing.s },
    pressed: { opacity: 0.7 },
  })

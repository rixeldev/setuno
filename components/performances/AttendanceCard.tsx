import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Card, Chip } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { useToast } from "@/components/ui/Toast"
import { ATTENDANCE_STATUS_KEYS } from "@/interfaces"
import type { AttendanceStatus, OrganizationMember } from "@/interfaces"
import { ATTENDANCE_STATUSES, partitionAttendance } from "@/libs/eventLogistics"
import { setAttendance } from "@/services/eventLogistics"
import { toFriendlyError } from "@/services/errors"

const TONE_BY_STATUS: Record<AttendanceStatus, "success" | "accent" | "danger"> = {
  yes: "success",
  maybe: "accent",
  no: "danger",
}

interface AttendanceCardProps {
  organizationId: string
  performanceId: string
  /** Sanitized uid → RSVP map from the event document (roadmap #47). */
  attendance: Record<string, AttendanceStatus>
  members: OrganizationMember[]
  currentUid: string
}

/**
 * The event's RSVP block (roadmap #47): your own answer as three chips, then
 * the band grouped by answer. Writing touches only your own key — the rules
 * enforce it and `setAttendance` writes exactly that one dot path — so nobody
 * can answer (or retract) for another member, and two answers at once can
 * never clobber each other.
 */
export function AttendanceCard({
  organizationId,
  performanceId,
  attendance,
  members,
  currentUid,
}: AttendanceCardProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const buckets = partitionAttendance(attendance, members)
  const current = attendance[currentUid] ?? null
  const answered = buckets.going.length + buckets.maybe.length + buckets.no.length

  const answer = async (status: AttendanceStatus) => {
    setBusy(true)
    try {
      await setAttendance(organizationId, performanceId, status)
      toast.showSuccess(t("performances.rsvpSaved"))
    } catch (error) {
      toast.showError(toFriendlyError(error, t("performances.rsvpError")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card style={styles.card}>
      <AppText variant="heading">{t("performances.attendance")}</AppText>

      <View style={styles.chipRow}>
        {ATTENDANCE_STATUSES.map((status) => (
          <Chip
            key={status}
            label={t(ATTENDANCE_STATUS_KEYS[status])}
            tone={TONE_BY_STATUS[status]}
            selected={current === status}
            disabled={busy}
            onPress={() => answer(status)}
          />
        ))}
      </View>

      {answered === 0 ? (
        <AppText variant="caption" tone="muted">
          {t("performances.rsvpEmpty")}
        </AppText>
      ) : null}

      {(["going", "maybe", "no"] as const).map((bucket) =>
        buckets[bucket].length > 0 ? (
          <View key={bucket} style={styles.bucket}>
            <AppText variant="caption" tone={TONE_BY_STATUS[bucket === "going" ? "yes" : bucket]}>
              {t(ATTENDANCE_STATUS_KEYS[bucket === "going" ? "yes" : bucket])}
            </AppText>
            <View style={styles.people}>
              {buckets[bucket].map((member) => (
                <View key={member.uid} style={styles.person}>
                  <Avatar
                    name={member.displayName}
                    photoURL={member.photoURL}
                    size={20}
                    maxInitials={1}
                  />
                  <AppText variant="caption" numberOfLines={1} style={styles.personName}>
                    {member.displayName}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        ) : null,
      )}

      {buckets.unanswered.length > 0 ? (
        <AppText variant="caption" tone="muted">
          {t("performances.rsvpUnanswered", { count: buckets.unanswered.length })}
        </AppText>
      ) : null}
    </Card>
  )
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: Theme.spacing.m },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.s },
    bucket: { gap: Theme.spacing.xs },
    people: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.s },
    person: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.xs,
      maxWidth: "100%",
    },
    personName: { flexShrink: 1 },
  })

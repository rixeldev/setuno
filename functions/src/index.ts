import { initializeApp } from "firebase-admin/app"
import { type Firestore, getFirestore } from "firebase-admin/firestore"
import { logger } from "firebase-functions/v2"
import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore"
import { onSchedule } from "firebase-functions/v2/scheduler"

import { TRASH_TTL_DAYS, purgeExpiredSongs } from "./purge"
import {
  buildPushMessage,
  isPushLanguage,
  pushTypeEnabled,
  type PushContext,
  type PushLanguage,
  type PushNotificationType,
} from "./notify"
import { sendExpoPush, type ExpoPushMessage } from "./expoPush"

initializeApp()

/**
 * The Cloud Functions workspace (roadmap P0.1) opens with the scheduled half
 * of the song trash (#31): every day, songs that spent their 30 days in the
 * trash are deleted for good. Until this function is deployed the trash holds
 * forever and purging is manual; once it runs, the trash screen's promise —
 * "you have 30 days to restore" — is kept by the schedule. The odd minute
 * keeps the run off the top-of-hour stampede, where the whole internet fires
 * at once.
 */
export const purgeTrashedSongs = onSchedule(
  {
    schedule: "every day 04:17",
    timeZone: "UTC",
    memory: "256MiB",
    timeoutSeconds: 540,
  },
  async () => {
    const result = await purgeExpiredSongs(getFirestore(), new Date())
    logger.info("purgeTrashedSongs finished", {
      ttlDays: TRASH_TTL_DAYS,
      songs: result.songs,
      versions: result.versions,
    })
  },
)

// ---------------------------------------------------------------------------
// Push notifications (roadmap #52)
//
// Five band events fan out to the members whose preferences allow them, via
// their registered devices (`users/{uid}/devices`, one doc per install). Every
// send is best-effort: a push provider hiccup must never look like a broken
// write, so each recipient is wrapped and logged instead of thrown. The
// message strings and the opt-out contract live in `notify.ts` (pure, shared
// with the app); the HTTP hop lives in `expoPush.ts`.
// ---------------------------------------------------------------------------

/** Trimmed non-empty string, or `undefined` for the templates' fallbacks. */
const text = (value: unknown): string | undefined => {
  const result = typeof value === "string" ? value.trim() : ""
  return result.length > 0 ? result : undefined
}

const memberUids = async (
  db: Firestore,
  organizationId: string,
  role?: string,
): Promise<string[]> => {
  const snapshot = await db.collection(`organizations/${organizationId}/members`).get()
  return snapshot.docs
    .filter((member) => !role || member.data().role === role)
    .map((member) => member.id)
}

const bandNameOf = async (db: Firestore, organizationId: string): Promise<string | undefined> => {
  const organization = await db.doc(`organizations/${organizationId}`).get()
  return text(organization.data()?.name)
}

/**
 * Delivers one notification type to the given users, honouring each user's
 * opt-outs (`preferences.notifications` — absent means enabled) and their
 * registered devices. Tokens the push service reports as `DeviceNotRegistered`
 * (app uninstalled) are pruned so the list keeps itself clean.
 */
const notifyUsers = async (
  db: Firestore,
  uids: readonly string[],
  type: PushNotificationType,
  context: PushContext,
  organizationId: string,
): Promise<void> => {
  for (const uid of [...new Set(uids)]) {
    if (!uid) continue
    try {
      const userDoc = await db.doc(`users/${uid}`).get()
      const preferences = userDoc.data()?.preferences ?? null
      if (!pushTypeEnabled(preferences, type)) continue
      const devices = await db.collection(`users/${uid}/devices`).get()
      if (devices.empty) continue
      const tokensByLang = new Map<PushLanguage, string[]>()
      for (const device of devices.docs) {
        const data = device.data()
        const token = text(data.token)
        if (!token) continue
        // A device registered by an older client (or written by hand) can
        // carry an unknown language: fall back to English, never skip.
        const lang = isPushLanguage(data.lang) ? data.lang : "en"
        tokensByLang.set(lang, [...(tokensByLang.get(lang) ?? []), token])
      }
      const messages: ExpoPushMessage[] = []
      for (const [lang, tokens] of tokensByLang) {
        const { title, body } = buildPushMessage(type, lang, context)
        for (const token of tokens) {
          messages.push({
            to: token,
            title,
            body,
            sound: "default",
            data: { organizationId, type },
          })
        }
      }
      if (messages.length === 0) continue
      const failures = await sendExpoPush(messages)
      for (const failure of failures) {
        if (failure.reason !== "DeviceNotRegistered") continue
        await db
          .doc(`users/${uid}/devices/${failure.token}`)
          .delete()
          .catch(() => undefined)
      }
    } catch (error) {
      logger.error("notifyUsers failed", { uid, type, error })
    }
  }
}

/** New suggestion: every admin of the band, except its own author. */
export const onSuggestionCreated = onDocumentCreated(
  "organizations/{organizationId}/suggestions/{suggestionId}",
  async (event) => {
    const suggestion = event.data?.data()
    if (!suggestion) return
    const db = getFirestore()
    const admins = await memberUids(db, event.params.organizationId, "admin")
    await notifyUsers(
      db,
      admins.filter((uid) => uid !== text(suggestion.authorId)),
      "suggestionCreated",
      {
        actorName: text(suggestion.authorName),
        songTitle: text(suggestion.songTitle),
        bandName: await bandNameOf(db, event.params.organizationId),
      },
      event.params.organizationId,
    )
  },
)

/** Suggestion resolved: its author, once (self-reviews never notify). */
export const onSuggestionResolved = onDocumentUpdated(
  "organizations/{organizationId}/suggestions/{suggestionId}",
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after) return
    // Only the moment it leaves "pending" is news; later edits are not.
    if (before.status === after.status || after.status === "pending") return
    const authorId = text(after.authorId)
    if (!authorId || authorId === text(after.reviewedBy)) return
    const db = getFirestore()
    await notifyUsers(
      db,
      [authorId],
      "suggestionResolved",
      {
        actorName: text(after.reviewedByName),
        songTitle: text(after.songTitle),
        bandName: await bandNameOf(db, event.params.organizationId),
        status: after.status === "rejected" ? "rejected" : "accepted",
      },
      event.params.organizationId,
    )
  },
)

/** New event on the calendar: the whole band, except whoever added it. */
export const onPerformanceCreated = onDocumentCreated(
  "organizations/{organizationId}/performances/{performanceId}",
  async (event) => {
    const performance = event.data?.data()
    if (!performance) return
    const db = getFirestore()
    const creator = text(performance.createdBy)
    const members = await memberUids(db, event.params.organizationId)
    await notifyUsers(
      db,
      members.filter((uid) => uid !== creator),
      "performanceCreated",
      {
        eventName: text(performance.name),
        eventDate: text(performance.date),
        bandName: await bandNameOf(db, event.params.organizationId),
      },
      event.params.organizationId,
    )
  },
)

/**
 * New invitation: the invitee, matched by email through the Admin SDK — the
 * only place that may read other profiles (`firestore.rules` forbids the
 * client from doing it, docs §23). No matching profile means nobody to ping.
 */
export const onInvitationCreated = onDocumentCreated(
  "organizations/{organizationId}/invitations/{invitationId}",
  async (event) => {
    const invitation = event.data?.data()
    if (!invitation) return
    const email = text(invitation.email)?.toLowerCase()
    if (!email) return
    const db = getFirestore()
    const users = await db.collection("users").where("email", "==", email).limit(1).get()
    if (users.empty) return
    await notifyUsers(
      db,
      [users.docs[0].id],
      "invitationReceived",
      {
        actorName: text(invitation.invitedByName),
        bandName: text(invitation.organizationName),
      },
      event.params.organizationId,
    )
  },
)

/** Role change: the member themselves. Profile mirrors ride along silently. */
export const onMemberRoleChanged = onDocumentUpdated(
  "organizations/{organizationId}/members/{memberUid}",
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after) return
    if (before.role === after.role) return
    const db = getFirestore()
    await notifyUsers(
      db,
      [event.params.memberUid],
      "membershipChanged",
      {
        bandName: await bandNameOf(db, event.params.organizationId),
        membership: "role",
      },
      event.params.organizationId,
    )
  },
)

/** Removed from the band: the removed member. */
export const onMemberRemoved = onDocumentDeleted(
  "organizations/{organizationId}/members/{memberUid}",
  async (event) => {
    const db = getFirestore()
    // Deleting a whole band cascades through its members (see
    // `services/organizations.ts#deleteOrganization`): those removals are not
    // "you were kicked", so a vanished organization stays silent.
    const organization = await db.doc(`organizations/${event.params.organizationId}`).get()
    if (!organization.exists) return
    await notifyUsers(
      db,
      [event.params.memberUid],
      "membershipChanged",
      {
        bandName: text(organization.data()?.name),
        membership: "removed",
      },
      event.params.organizationId,
    )
  },
)

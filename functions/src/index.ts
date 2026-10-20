import { randomBytes } from "crypto"
import { initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { Timestamp, type Firestore, getFirestore } from "firebase-admin/firestore"
import { logger } from "firebase-functions/v2"
import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
  onDocumentUpdatedWithAuthContext,
} from "firebase-functions/v2/firestore"
import { HttpsError, onCall } from "firebase-functions/v2/https"
import { defineSecret } from "firebase-functions/params"
import { onSchedule } from "firebase-functions/v2/scheduler"

import { TRASH_TTL_DAYS, purgeExpiredSongs } from "./purge"
import {
  ACCOUNT_EXPORT_BYTES_MAX,
  accountExportFileName,
  collectAccountExport,
  deleteAccountData,
} from "./accountData"
import {
  SHARE_EXPIRY_DAYS,
  SHARE_PAYLOAD_BYTES_MAX,
  SHARE_VERSION,
  isShareToken,
  sanitizeShareTitle,
  sanitizeSharedSetlist,
  sanitizeSharedSong,
  shareExpiryAt,
  type ShareKind,
} from "./shares"
import {
  buildPushMessage,
  isPushLanguage,
  pushTypeEnabled,
  type PushContext,
  type PushLanguage,
  type PushNotificationType,
} from "./notify"
import { extractMentionUids, type MentionMember } from "./mentions"
import { sendExpoPush, type ExpoPushMessage } from "./expoPush"
import {
  PRO_PRODUCTS,
  isKnownProduct,
  mapEntitlement,
  type Entitlement,
} from "./entitlements"
import {
  consumePlayPurchase,
  serviceAccountFromEnv,
  serviceAccountFromJson,
  verifyPlayPurchase,
  type ServiceAccount,
} from "./playBilling"

initializeApp()

/**
 * The store credential.
 *
 * It lives in **Secret Manager** (`PLAY_SERVICE_ACCOUNT_JSON`), which the
 * deploy binds to the callable: a credential never travels inside the
 * deployment, and it can be rotated without a code change. The environment is
 * the fallback (the emulator reads it from the local `.env`).
 */
const playServiceAccount = defineSecret("PLAY_SERVICE_ACCOUNT_JSON")

/** The credential, from the secret first and the environment after. */
const resolveServiceAccount = async (): Promise<ServiceAccount | null> => {
  try {
    const value = await playServiceAccount.value()
    if (value) {
      const fromSecret = serviceAccountFromJson(value)
      if (fromSecret) return fromSecret
    }
  } catch {
    // The secret is not bound (or not readable here) — the environment may
    // still carry it.
  }
  return serviceAccountFromEnv()
}

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
      presence: result.presence,
    })
  },
)

// ---------------------------------------------------------------------------
// Push notifications (roadmap #52)
//
// The band's events fan out to the members whose preferences allow them, via
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
 * The roster `@mentions` resolve against (roadmap #58): every collaborator's
 * display name — guests excluded, because they read the night but never the
 * suggestions surface, so a mention they cannot open would only be noise. The
 * app's composer filters the same way through `canCollaborate`, so the handle
 * a member can tap and the handle this trigger notifies are one set.
 */
const memberRoster = async (
  db: Firestore,
  organizationId: string,
): Promise<MentionMember[]> => {
  const snapshot = await db.collection(`organizations/${organizationId}/members`).get()
  return snapshot.docs
    .filter((member) => member.data().role !== "guest")
    .map((member) => ({
      uid: member.id,
      displayName: text(member.data().displayName) ?? "",
    }))
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

/** New `@mention` in a comment (roadmap #58): each mentioned member once.
 * The parse is `mentions.ts` — the very code the composer and the comment
 * renderer use — so nobody is notified for a handle the thread does not light
 * up, and the comment's own author never pings themselves. */
export const onSuggestionCommentCreated = onDocumentCreated(
  "organizations/{organizationId}/suggestions/{suggestionId}/comments/{commentId}",
  async (event) => {
    const comment = event.data?.data()
    if (!comment || comment.deletedAt) return
    const body = text(comment.body)
    if (!body) return
    const db = getFirestore()
    const roster = await memberRoster(db, event.params.organizationId)
    const authorId = text(comment.authorId)
    const mentioned = extractMentionUids(body, roster).filter((uid) => uid !== authorId)
    if (mentioned.length === 0) return
    const suggestion = await db
      .doc(`organizations/${event.params.organizationId}/suggestions/${event.params.suggestionId}`)
      .get()
    await notifyUsers(
      db,
      mentioned,
      "commentMentioned",
      {
        actorName: text(comment.authorName),
        songTitle: text(suggestion.data()?.songTitle),
        bandName: await bandNameOf(db, event.params.organizationId),
      },
      event.params.organizationId,
    )
  },
)

/** Suggestion assigned (roadmap #58): the new assignee, once, and never the
 * member who claimed it for themselves. The rules pin the assignment to a
 * one-field update on a pending suggestion, so any `assigneeId` change here
 * is a real hand-off; the actor rides the write's auth context
 * (`authId` is the signed-in uid a member's client write always carries —
 * Firestore reports it under the generic "unknown" auth type). */
export const onSuggestionAssigned = onDocumentUpdatedWithAuthContext(
  "organizations/{organizationId}/suggestions/{suggestionId}",
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after) return
    const assigneeId = text(after.assigneeId)
    if (!assigneeId || assigneeId === text(before.assigneeId)) return
    const actorUid = event.authId ?? null
    if (actorUid && assigneeId === actorUid) return
    const db = getFirestore()
    const actor = actorUid ? await db.doc(`users/${actorUid}`).get() : null
    await notifyUsers(
      db,
      [assigneeId],
      "suggestionAssigned",
      {
        actorName: text(actor?.data()?.displayName),
        songTitle: text(after.songTitle),
        bandName: await bandNameOf(db, event.params.organizationId),
      },
      event.params.organizationId,
    )
  },
)

/** New event on the calendar: the whole band, except whoever added it.
 * Guests included (roadmap #59): a sub or tech who is read-only to the band's
 * conversation still wants the call time. */
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

// --------------------------------------------------------------- share links
//
// Roadmap #56: a member publishes a song or setlist as a read-only link.
// `shares/{token}` is written only from the *stored source document* through
// the Admin SDK — never from caller-supplied content — so a payload cannot be
// fabricated, and it bypasses the security rules exactly like every other
// Admin SDK write: `firestore.rules` grants an anonymous `get` by exact token
// and denies listing, so holding the link is the only way to reach it.

/** 16 random bytes as base64url — 22 path-safe characters, 128 bits of entropy. */
const SHARE_TOKEN_BYTES = 16

const readCallInput = (data: unknown): Record<string, unknown> =>
  typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {}

/**
 * Publish (or refresh) the band's link for one song or setlist. Idempotent per
 * source: an active link keeps its token while its snapshot and expiry are
 * rewritten in place, so "share again" never hands out a second URL — expired
 * twins and duplicates are cleaned up in the same batch.
 */
export const createShare = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to share")
  const uid = request.auth.uid
  const data = readCallInput(request.data)

  const kind: ShareKind | null =
    data.kind === "song" || data.kind === "setlist" ? data.kind : null
  const organizationId = typeof data.organizationId === "string" ? data.organizationId : ""
  const sourceId = typeof data.sourceId === "string" ? data.sourceId : ""
  if (
    !kind ||
    organizationId.length === 0 ||
    organizationId.length > 128 ||
    sourceId.length === 0 ||
    sourceId.length > 128
  ) {
    throw new HttpsError("invalid-argument", "kind, organizationId and sourceId are required")
  }
  let expiresInDays: number | null = null
  const rawDays = data.expiresInDays
  if (rawDays !== null && rawDays !== undefined) {
    if (typeof rawDays !== "number" || !SHARE_EXPIRY_DAYS.includes(rawDays)) {
      throw new HttpsError("invalid-argument", "Unsupported expiry")
    }
    expiresInDays = rawDays
  }

  const db = getFirestore()
  // Membership first: sharing publishes band content to the world, so the
  // caller must belong to the band that owns the source.
  const member = await db.doc(`organizations/${organizationId}/members/${uid}`).get()
  if (!member.exists) throw new HttpsError("permission-denied", "You are not a member of this band")

  const sourceRef =
    kind === "song"
      ? db.doc(`organizations/${organizationId}/songs/${sourceId}`)
      : db.doc(`organizations/${organizationId}/setlists/${sourceId}`)
  const source = await sourceRef.get()
  if (!source.exists) throw new HttpsError("not-found", "That song or setlist no longer exists")
  const raw = source.data() ?? {}
  if (kind === "song" && raw.deletedAt !== null && raw.deletedAt !== undefined) {
    throw new HttpsError("failed-precondition", "Restore the song from the trash to share it")
  }

  const title = sanitizeShareTitle(raw.title)
  const payload = kind === "song" ? sanitizeSharedSong(raw) : sanitizeSharedSetlist(raw)
  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > SHARE_PAYLOAD_BYTES_MAX) {
    throw new HttpsError("resource-exhausted", "This share is too large to publish")
  }

  const now = Timestamp.now()
  const expiresMs = shareExpiryAt(expiresInDays, now.toMillis())
  const expiresAt = expiresMs === null ? null : Timestamp.fromMillis(expiresMs)

  const existing = await db
    .collection("shares")
    .where("kind", "==", kind)
    .where("organizationId", "==", organizationId)
    .where("sourceId", "==", sourceId)
    .get()
  // Keep exactly one live link (lowest token, so every caller agrees on which)
  // and delete the rest: whatever is expired is dead, whatever else is live is
  // a duplicate from before this contract existed.
  const live = existing.docs
    .filter((entry) => {
      const expires = entry.data().expiresAt as Timestamp | null | undefined
      return !expires || expires.toMillis() > now.toMillis()
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1))
  const kept = live[0]

  const batch = db.batch()
  let token: string
  if (kept) {
    token = kept.id
    batch.update(kept.ref, {
      version: SHARE_VERSION,
      title,
      payload,
      createdBy: uid,
      expiresAt,
      updatedAt: now,
    })
  } else {
    token = randomBytes(SHARE_TOKEN_BYTES).toString("base64url")
    batch.set(db.doc(`shares/${token}`), {
      version: SHARE_VERSION,
      kind,
      organizationId,
      sourceId,
      title,
      payload,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    })
  }
  for (const extra of existing.docs) {
    if (!kept || extra.id !== kept.id) batch.delete(extra.ref)
  }
  await batch.commit()

  return { token, expiresAt: expiresMs, reused: Boolean(kept) }
})

/**
 * Kill a link for good (the document is deleted, so the public `get` finds
 * nothing). The link's creator may revoke it, and so may any admin of the band
 * it belongs to — "revocable" in the roadmap means either can pull it back.
 * Missing tokens answer `revoked: true`: a second tap stays a no-op.
 */
export const revokeShare = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to revoke a link")
  const uid = request.auth.uid
  const data = readCallInput(request.data)
  if (!isShareToken(data.token)) {
    throw new HttpsError("invalid-argument", "token is required")
  }

  const db = getFirestore()
  const ref = db.doc(`shares/${data.token}`)
  const share = await ref.get()
  if (!share.exists) return { revoked: true }

  const snapshot = share.data() ?? {}
  if (snapshot.createdBy !== uid) {
    const organizationId = typeof snapshot.organizationId === "string" ? snapshot.organizationId : ""
    const member = await db.doc(`organizations/${organizationId}/members/${uid}`).get()
    if (member.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Only the creator or an admin can revoke this link")
    }
  }
  await ref.delete()
  return { revoked: true }
})

// ------------------------------------------------------- account data (#68)
//
// Roadmap #68: the account's own export and the account's own deletion. Both
// run through the Admin SDK (no `firestore.rules` change ships with them),
// and the client re-authenticates *before* `deleteMyAccount` — the
// re-authentication is deliberately client-side, because the password /
// Google challenge belongs to the provider's own SDK, exactly where the
// roadmap puts it. `functions/src/accountData.ts` owns every decision that
// can be made without a database; the wrapper below is thin.

/**
 * Everything the account owns, as one indented JSON document — the app hands
 * it straight to the OS share sheet (native) or the browser download (web),
 * so nothing about the account ever sits behind a URL.
 */
export const exportMyData = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to export your data")
  const uid = request.auth.uid
  const email = typeof request.auth.token.email === "string" ? request.auth.token.email : null

  const now = new Date()
  const account = await collectAccountExport(getFirestore(), uid, email, now)
  const json = JSON.stringify(account, null, 2)
  if (Buffer.byteLength(json, "utf8") > ACCOUNT_EXPORT_BYTES_MAX) {
    throw new HttpsError("resource-exhausted", "This account's export is too large to hand over")
  }
  return { json, filename: accountExportFileName(now) }
})

/**
 * Delete the account for good: the member walks out of every band (a band
 * left with nobody in it goes too, a band left without an admin promotes its
 * most senior member and receives the new `ownerId`), the username claim is
 * released, every document under `users/{uid}` goes, and the Auth user is
 * removed last — the only step that cannot run twice, so a retry after a
 * half-finished run finds its `auth/user-not-found` answer to be success.
 * The band's own content stays behind: it belongs to the band.
 */
export const deleteMyAccount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to delete your account")
  const uid = request.auth.uid
  const data = readCallInput(request.data)
  if (data.confirmed !== true) {
    throw new HttpsError("failed-precondition", "Confirm the deletion in the app first")
  }

  const summary = await deleteAccountData(getFirestore(), uid)
  try {
    await getAuth().deleteUser(uid)
  } catch (error) {
    const code = (error as { code?: unknown }).code
    if (code !== "auth/user-not-found") {
      logger.error("deleteMyAccount could not remove the Auth user", error)
      throw new HttpsError("internal", "We couldn't finish deleting the account. Try again.")
    }
  }
  return { deleted: true, ...summary }
})

/**
 * End every session on this account (roadmap #69). Revoke the refresh tokens
 * — every device and browser signs itself out at the next refresh — and sweep
 * the push registrations in the same call, so the account's device list
 * empties instead of advertising sessions that are gone. Each phone keeps its
 * cached token, and #52's contract reads a missing document as the durable
 * *off* state, so a revoked device never resurrects its own registration.
 *
 * Caller-scoped by construction: the uid comes from the verified token and no
 * argument is read, so nobody can revoke anybody else.
 */
export const signOutEverywhere = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to manage your sessions")
  const uid = request.auth.uid

  await getAuth().revokeRefreshTokens(uid)
  const devices = await getFirestore()
    .collection(`users/${uid}/devices`)
    .listDocuments()
  // Tens of documents at most (one per phone/tablet install); Firestore caps
  // a batch at 500, so a plain fan-out is honest and simpler.
  await Promise.all(devices.map((device) => device.delete()))
  logger.info("signOutEverywhere revoked a session and swept its devices", {
    uid,
    devices: devices.length,
  })
  return { revoked: true, devices: devices.length }
})

/**
 * The member's plan (roadmap #61).
 *
 * The entitlement is written by `syncProPurchase` and read here; a **missing**
 * document simply reads as the free plan, so a brand-new account never has to
 * ask twice. The call is scoped to the caller's own uid: no argument is read,
 * so nobody can read anybody else's plan.
 */
export const getMyEntitlement = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to see your plan")
  const uid = request.auth.uid

  const snapshot = await getFirestore().doc(`users/${uid}/entitlements/pro`).get()
  const now = new Date().toISOString().slice(0, 10)
  return mapEntitlement(snapshot.exists ? snapshot.data() : null, now)
})

/**
 * Confirms a purchase with the store and settles the plan (roadmap #61, and
 * the tip of #64).
 *
 * The phone hands over the token the store gave it; the callable asks Google
 * whether that token is a real, paid purchase, and **only then** is the plan
 * written. The entitlement document is written with the Admin SDK, so the
 * client cannot write it at all — the rules have no `allow write` for it.
 *
 * A tip (a consumable, roadmap #64) is confirmed and consumed, so the member
 * can tip again, but it never grants the plan.
 */
export const syncProPurchase = onCall({ secrets: [playServiceAccount] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to manage your plan")
  const uid = request.auth.uid
  const data = readCallInput(request.data)

  const productId = typeof data.productId === "string" ? data.productId : ""
  const purchaseToken = typeof data.purchaseToken === "string" ? data.purchaseToken : ""
  if (!isKnownProduct(productId)) throw new HttpsError("invalid-argument", "Unknown product")
  if (purchaseToken.length === 0 || purchaseToken.length > 512) {
    throw new HttpsError("invalid-argument", "A purchase token is required")
  }

  const serviceAccount = await resolveServiceAccount()
  if (!serviceAccount) {
    // A missing credential must never fall back to "probably fine": the plan
    // stays free until the store can actually be asked.
    throw new HttpsError("failed-precondition", "The store is not configured on this server yet")
  }
  const packageName = process.env.ANDROID_PACKAGE_NAME ?? "com.rixeldev.setuno"
  const isTip = productId === PRO_PRODUCTS.tip

  let active = false
  let expiresAt: string | null = null
  try {
    const purchase = await verifyPlayPurchase({
      serviceAccount,
      packageName,
      productId,
      purchaseToken,
      kind: isTip ? "tip" : "subscription",
    })
    active = purchase.active
    expiresAt = purchase.expiresAt
    if (isTip) {
      // A tip is a consumable: confirm it and let it go, so it can be tipped
      // again. It never grants the plan.
      await consumePlayPurchase({
        serviceAccount,
        packageName,
        productId,
        purchaseToken,
      })
    }
  } catch (error) {
    logger.error("syncProPurchase could not confirm the purchase", {
      uid,
      productId,
      error: String(error),
    })
    throw new HttpsError("internal", "The store could not be reached")
  }

  const now = new Date().toISOString().slice(0, 10)
  const entitlement: Entitlement = {
    plan: !isTip && active ? "pro" : "free",
    productId,
    source: isTip ? "tip" : "play",
    expiresAt,
    updatedAt: now,
  }
  await getFirestore().doc(`users/${uid}/entitlements/pro`).set(entitlement, { merge: true })
  logger.info("syncProPurchase settled an entitlement", {
    uid,
    productId,
    active,
    plan: entitlement.plan,
  })
  return entitlement
})

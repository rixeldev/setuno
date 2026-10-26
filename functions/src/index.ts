import { randomBytes } from "crypto"
import { initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { FieldValue, Timestamp, type Firestore, getFirestore } from "firebase-admin/firestore"
import { logger } from "firebase-functions/v2"
import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
  onDocumentUpdatedWithAuthContext,
} from "firebase-functions/v2/firestore"
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https"
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
  INVITE_LINK_USES_MAX,
  inviteBandName,
  inviteLinkExpiryAt,
  inviteLinkIsDead,
  inviteMemberEmail,
  inviteMemberName,
  isInviteRole,
  isInviteToken,
  readInviteExpiryChoice,
  readRotateFlag,
  sanitizeInviteRole,
  type InviteRole,
} from "./inviteLinks"
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
import {
  createBillingPortalSession,
  createCheckoutSession,
  stripeApi,
  stripeConfigFromEnv,
  stripeOffers,
  subscriptionFromStripe,
  verifyStripeSignature,
  type StripeConfig,
} from "./stripe"

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

/**
 * Stripe's configuration (the **web** half of the plan, roadmap #61).
 *
 * The mobile build buys from Google Play; the web build buys from Stripe
 * Checkout, because Play Billing has no web implementation. Both write the
 * **same** entitlement document, so the plan belongs to the account and not to
 * the device.
 */
const stripeSecret = defineSecret("STRIPE_CONFIG")

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

/** Stripe's configuration, from the secret first and the environment after. */
const resolveStripeConfig = async (): Promise<StripeConfig | null> => {
  try {
    const value = await stripeSecret.value()
    if (value) {
      const fromSecret = stripeConfigFromEnv(value)
      if (fromSecret) return fromSecret
    }
  } catch {
    // Not bound here — the environment may still carry it.
  }
  return stripeConfigFromEnv(process.env.STRIPE_CONFIG)
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

// ------------------------------------------------------- invite links (#89)
//
// Roadmap #89: a band invites people by link and QR instead of asking for an
// email address. `inviteLinks/{token}` is written only through the Admin SDK —
// no security rule exists for it at all — so minting, previewing and redeeming
// all pass through these four callables. The ordinary emailed invitation keeps
// working untouched; this is a second door into the same membership, and
// `redeemInviteLink` writes exactly the documents `acceptInvitation` writes.

/** 16 random bytes as base64url — 22 path-safe characters, 128 bits of entropy. */
const INVITE_TOKEN_BYTES = 16

/** Firestore stamps read back as `Timestamp`; the callables speak epoch ms. */
const timestampMillis = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const holder = value as { toMillis?: () => number } | null | undefined
  return holder && typeof holder.toMillis === "function" ? holder.toMillis() : null
}

/**
 * Mint (or refresh) the band's invitation link. Admin-only, and idempotent per
 * band: a live link keeps its token while its role and deadline are rewritten,
 * so "share it again" never hands out a second URL. Expired links and
 * duplicates from before this contract are deleted in the same batch.
 *
 * `rotate: true` is the one thing that does change the URL: the current link
 * (and any twin) is deleted and a fresh token is minted with the same role and
 * deadline, because a link that has been forwarded one chat too far cannot be
 * un-forwarded. Its `uses` counter starts at zero — it is a different link.
 */
export const createInviteLink = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to invite your band")
  const uid = request.auth.uid
  const data = readCallInput(request.data)

  const organizationId = typeof data.organizationId === "string" ? data.organizationId : ""
  if (organizationId.length === 0 || organizationId.length > 128) {
    throw new HttpsError("invalid-argument", "A band is required")
  }
  if (!isInviteRole(data.role)) {
    throw new HttpsError("invalid-argument", "Unsupported role")
  }
  const role: InviteRole = data.role
  const expiresInDays = readInviteExpiryChoice(data.expiresInDays)
  if (expiresInDays === undefined) {
    throw new HttpsError("invalid-argument", "Unsupported expiry")
  }
  const rotate = readRotateFlag(data.rotate)

  const db = getFirestore()
  const organizationRef = db.doc(`organizations/${organizationId}`)
  const memberRef = db.doc(`organizations/${organizationId}/members/${uid}`)
  const organizationSnap = await organizationRef.get()
  if (!organizationSnap.exists) throw new HttpsError("not-found", "That band no longer exists")
  const memberSnap = await memberRef.get()
  if (memberSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Only an admin can create an invitation link")
  }

  const now = Timestamp.now()
  const nowMs = now.toMillis()
  const expiresMs = inviteLinkExpiryAt(expiresInDays, nowMs)
  const expiresAt = expiresMs === null ? null : Timestamp.fromMillis(expiresMs)
  const organizationName = inviteBandName(organizationSnap.data()?.name)
  const createdByName = inviteMemberName(memberSnap.data()?.displayName, request.auth.token.email)

  const existing = await db
    .collection("inviteLinks")
    .where("organizationId", "==", organizationId)
    .get()
  // One live link per band (lowest token, so every admin agrees on which one) —
  // unless the caller asked to rotate, in which case every existing document is
  // replaced by the new one below.
  const live = existing.docs
    .filter((entry) => !inviteLinkIsDead(entry.data().expiresAt, nowMs))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
  const kept = rotate ? undefined : live[0]

  const batch = db.batch()
  let token: string
  let uses = 0
  if (kept) {
    const stored = kept.data().uses
    uses = typeof stored === "number" && Number.isFinite(stored) ? stored : 0
    token = kept.id
    // The role and the deadline move; the `uses` counter does not — it counts
    // people who joined through this URL, and rewriting the rules does not
    // un-join them.
    batch.update(kept.ref, {
      organizationName,
      role,
      createdBy: uid,
      createdByName,
      expiresAt,
      updatedAt: now,
    })
  } else {
    token = randomBytes(INVITE_TOKEN_BYTES).toString("base64url")
    batch.set(db.doc(`inviteLinks/${token}`), {
      token,
      organizationId,
      organizationName,
      role,
      createdBy: uid,
      createdByName,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      uses: 0,
      lastUsedAt: null,
    })
  }
  for (const extra of existing.docs) {
    if (!kept || extra.id !== kept.id) batch.delete(extra.ref)
  }
  await batch.commit()

  logger.info("createInviteLink minted a link", {
    organizationId,
    role,
    expiresInDays,
    reused: Boolean(kept),
    rotated: rotate,
  })
  return { token, expiresAt: expiresMs, role, uses, reused: Boolean(kept) }
})

/**
 * Kill the band's link for good: the document is deleted, so the preview and
 * the redeem both find nothing. Admins of the band may revoke it (the link is
 * the band's, not the person's). A missing token answers `revoked: true`, so a
 * second tap stays a no-op.
 */
export const revokeInviteLink = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to revoke a link")
  const uid = request.auth.uid
  const data = readCallInput(request.data)
  if (!isInviteToken(data.token)) {
    throw new HttpsError("invalid-argument", "token is required")
  }

  const db = getFirestore()
  const ref = db.doc(`inviteLinks/${data.token}`)
  const snapshot = await ref.get()
  if (!snapshot.exists) return { revoked: true }

  const link = snapshot.data() ?? {}
  const organizationId = typeof link.organizationId === "string" ? link.organizationId : ""
  const member = await db.doc(`organizations/${organizationId}/members/${uid}`).get()
  if (member.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Only an admin can revoke this link")
  }
  await ref.delete()
  return { revoked: true }
})

/**
 * What the public join page shows before anybody signs in: the band's name,
 * the role the link grants, when it dies and how many people came through it.
 * Anonymous by design — the page has to be readable by a visitor who is not
 * signed in yet — and a link that is missing, expired or points at a band that
 * no longer exists collapses into one honest `gone` answer.
 */
export const previewInviteLink = onCall(async (request) => {
  const data = readCallInput(request.data)
  const gone = {
    state: "gone" as const,
    organizationId: "",
    organizationName: "",
    role: "member" as InviteRole,
    createdByName: "",
    expiresAt: null,
    uses: 0,
    alreadyMember: false,
  }
  if (!isInviteToken(data.token)) return gone

  const db = getFirestore()
  const snapshot = await db.doc(`inviteLinks/${data.token}`).get()
  if (!snapshot.exists) return gone
  const link = snapshot.data() ?? {}
  if (inviteLinkIsDead(link.expiresAt, Date.now())) return gone

  const organizationId = typeof link.organizationId === "string" ? link.organizationId : ""
  if (organizationId.length === 0) return gone
  // The band can be deleted while a link lives on: the redeem would refuse it,
  // so the page must say the same thing instead of naming a band that is gone.
  const organization = await db.doc(`organizations/${organizationId}`).get()
  if (!organization.exists) return gone

  let alreadyMember = false
  if (request.auth) {
    const member = await db.doc(`organizations/${organizationId}/members/${request.auth.uid}`).get()
    alreadyMember = member.exists
  }

  return {
    state: "ready" as const,
    organizationId,
    organizationName: inviteBandName(organization.data()?.name) || inviteBandName(link.organizationName),
    role: sanitizeInviteRole(link.role),
    createdByName: typeof link.createdByName === "string" ? link.createdByName : "",
    expiresAt: timestampMillis(link.expiresAt),
    uses: typeof link.uses === "number" ? link.uses : 0,
    alreadyMember,
  }
})

/**
 * Redeem a link: create the membership plus the caller's band index entry,
 * exactly as `acceptInvitation` does for an emailed invitation — but with the
 * Admin SDK, because no invitation document (and so no email) exists here.
 *
 * Multi-use and idempotent: somebody who already belongs to the band gets
 * `alreadyMember: true` and keeps the role they have (walking your own link is
 * not a promotion), while the `uses` counter moves once per new member. The
 * transaction reads everything before it writes, so two people scanning at the
 * same moment cannot overwrite each other's membership.
 */
export const redeemInviteLink = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to join the band")
  const uid = request.auth.uid
  const data = readCallInput(request.data)
  if (!isInviteToken(data.token)) {
    throw new HttpsError("invalid-argument", "token is required")
  }
  const token = data.token
  const db = getFirestore()
  const now = Timestamp.now()
  // The profile can be a moment younger than the account (a fresh sign-up
  // arriving straight through this link), so the Auth token is the fallback.
  const displayName = inviteMemberName(request.auth.token.name, request.auth.token.email)
  const email = inviteMemberEmail(request.auth.token.email)
  const photoURL = typeof request.auth.token.picture === "string" ? request.auth.token.picture : null

  const outcome = await db.runTransaction(async (transaction) => {
    const linkRef = db.doc(`inviteLinks/${token}`)
    const linkSnap = await transaction.get(linkRef)
    if (!linkSnap.exists) {
      throw new HttpsError("not-found", "This invitation link is no longer valid")
    }
    const link = linkSnap.data() ?? {}
    if (inviteLinkIsDead(link.expiresAt, now.toMillis())) {
      throw new HttpsError("failed-precondition", "This invitation link has expired")
    }
    const organizationId = typeof link.organizationId === "string" ? link.organizationId : ""
    if (organizationId.length === 0) {
      throw new HttpsError("not-found", "This invitation link is no longer valid")
    }

    const memberRef = db.doc(`organizations/${organizationId}/members/${uid}`)
    const organizationRef = db.doc(`organizations/${organizationId}`)
    const memberSnap = await transaction.get(memberRef)
    const organizationSnap = await transaction.get(organizationRef)
    if (!organizationSnap.exists) throw new HttpsError("not-found", "That band no longer exists")

    const organizationName =
      inviteBandName(organizationSnap.data()?.name) || inviteBandName(link.organizationName)
    if (memberSnap.exists) {
      return {
        organizationId,
        organizationName,
        role: sanitizeInviteRole(memberSnap.data()?.role),
        alreadyMember: true,
      }
    }

    const uses = typeof link.uses === "number" && Number.isFinite(link.uses) ? link.uses : 0
    if (uses >= INVITE_LINK_USES_MAX) {
      throw new HttpsError("resource-exhausted", "This invitation link is no longer valid")
    }

    const role = sanitizeInviteRole(link.role)
    const invitedBy =
      typeof link.createdBy === "string" && link.createdBy.length > 0 ? link.createdBy : null
    transaction.set(memberRef, {
      uid,
      displayName,
      email,
      photoURL,
      role,
      joinedAt: now,
      invitedBy,
      instruments: [],
    })
    // The caller's private band index, the same shape `acceptInvitation`
    // writes: the app's band list listens here, so the new band appears
    // without a restart.
    transaction.set(db.doc(`users/${uid}/organizations/${organizationId}`), {
      name: organizationName,
      role,
      logoURL: null,
      joinedAt: now,
    })
    transaction.update(linkRef, { uses: uses + 1, lastUsedAt: now })
    return { organizationId, organizationName, role, alreadyMember: false }
  })

  // The feed line `acceptInvitation` logs, best-effort: the membership already
  // exists, so a failed log must never fail the redemption.
  if (!outcome.alreadyMember) {
    try {
      await db.collection(`organizations/${outcome.organizationId}/activity`).add({
        organizationId: outcome.organizationId,
        type: "invitation_accepted",
        message: `${displayName || email} joined the band`,
        actorId: uid,
        actorName: displayName || email,
        targetType: "member",
        targetId: uid,
        createdAt: FieldValue.serverTimestamp(),
      })
    } catch (error) {
      logger.warn("redeemInviteLink could not log the join", error)
    }
  }

  return outcome
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
 * The entitlement lives on the **band**, not on the account: the band
 * subscribes (an admin buys it) and every member of it gets the perks — the
 * ads disappear on every member's device, the band's statistics open, and the
 * songbook stops having a ceiling. A per-account entitlement would have left
 * the band's songbook limit applying to the members who did not buy anything.
 */
export const getMyEntitlement = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to see your plan")
  const uid = request.auth.uid
  const data = readCallInput(request.data)
  const organizationId = typeof data.organizationId === "string" ? data.organizationId : ""
  if (organizationId.length === 0) throw new HttpsError("invalid-argument", "A band is required")

  const db = getFirestore()
  // The plan belongs to the band, so the caller has to belong to it.
  const member = await db.doc(`organizations/${organizationId}/members/${uid}`).get()
  if (!member.exists) throw new HttpsError("permission-denied", "You are not a member of this band")

  const snapshot = await db.doc(`organizations/${organizationId}/entitlement/pro`).get()
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
  const organizationId = typeof data.organizationId === "string" ? data.organizationId : ""
  if (!isKnownProduct(productId)) throw new HttpsError("invalid-argument", "Unknown product")
  if (purchaseToken.length === 0 || purchaseToken.length > 512) {
    throw new HttpsError("invalid-argument", "A purchase token is required")
  }
  const isTip = productId === PRO_PRODUCTS.tip
  if (!isTip && organizationId.length === 0) {
    throw new HttpsError("invalid-argument", "A band is required")
  }

  const serviceAccount = await resolveServiceAccount()
  if (!serviceAccount) {
    // A missing credential must never fall back to "probably fine": the plan
    // stays free until the store can actually be asked.
    throw new HttpsError("failed-precondition", "The store is not configured on this server yet")
  }
  const packageName = process.env.ANDROID_PACKAGE_NAME ?? "com.rixeldev.setuno"

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
  if (isTip) {
    // A tip grants **nothing** — and it must not take anything away either: a
    // band that already has Pro keeps its plan. The tip is recorded on the
    // account that gave it (it is not the band's), and it carries nothing but
    // the tip and the date.
    const tip: Entitlement = {
      plan: "free",
      productId,
      source: "tip",
      expiresAt: null,
      updatedAt: now,
    }
    await getFirestore()
      .doc(`users/${uid}/entitlements/tip`)
      .set({ productId, source: "tip", updatedAt: now }, { merge: true })
    logger.info("syncProPurchase recorded a tip", { uid, productId })
    return tip
  }

  const entitlement: Entitlement = {
    plan: active ? "pro" : "free",
    productId,
    source: "play",
    expiresAt,
    updatedAt: now,
  }
  // The plan belongs to the **band**, and only an admin of it may buy it — a
  // member cannot gift Pro to a band they do not run, and cannot buy it for
  // somebody else's band either.
  const member = await getFirestore()
    .doc(`organizations/${organizationId}/members/${uid}`)
    .get()
  if (!member.exists) {
    throw new HttpsError("permission-denied", "You are not a member of this band")
  }
  if (member.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Only a band admin can buy the plan")
  }
  await getFirestore()
    .doc(`organizations/${organizationId}/entitlement/pro`)
    .set(entitlement, { merge: true })
  logger.info("syncProPurchase settled an entitlement", {
    uid,
    organizationId,
    productId,
    active,
    plan: entitlement.plan,
  })
  return entitlement
})

/**
 * The two plans and what they cost (the **web** half of the plan, roadmap #61).
 *
 * The prices come from Stripe itself, so the web build never shows a number
 * the store does not charge.
 */
export const getPlanOffers = onCall({ secrets: [stripeSecret] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to see the plans")
  const config = await resolveStripeConfig()
  if (!config) throw new HttpsError("failed-precondition", "The store is not configured yet")
  try {
    return { offers: await stripeOffers(config) }
  } catch (error) {
    logger.error("getPlanOffers could not read the catalogue", { error: String(error) })
    throw new HttpsError("internal", "The store could not be reached")
  }
})

/**
 * Opens Stripe's Checkout for a plan.
 *
 * The member's uid travels inside the session's metadata, so the webhook can
 * tell whose purchase it is **without trusting the browser** ✓. The client
 * never says who it is.
 */
export const startCheckout = onCall({ secrets: [stripeSecret] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to buy the plan")
  const uid = request.auth.uid
  const data = readCallInput(request.data)
  const plan = data.plan === "annual" ? "annual" : data.plan === "monthly" ? "monthly" : null
  const organizationId = typeof data.organizationId === "string" ? data.organizationId : ""
  if (!plan) throw new HttpsError("invalid-argument", "Unknown plan")
  if (organizationId.length === 0) throw new HttpsError("invalid-argument", "A band is required")

  // The plan belongs to the band, so only one of its admins can buy it.
  const member = await getFirestore()
    .doc(`organizations/${organizationId}/members/${uid}`)
    .get()
  if (!member.exists) {
    throw new HttpsError("permission-denied", "You are not a member of this band")
  }
  if (member.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Only a band admin can buy the plan")
  }

  const config = await resolveStripeConfig()
  if (!config) throw new HttpsError("failed-precondition", "The store is not configured yet")
  const origin = config.webOrigin ?? "https://setuno.vercel.app"
  try {
    const session = await createCheckoutSession({
      config,
      uid,
      email: request.auth.token.email ?? "",
      plan,
      organizationId,
      successUrl: `${origin}/settings/plan?checkout=success`,
      cancelUrl: `${origin}/settings/plan?checkout=cancelled`,
    })
    return { url: session.url }
  } catch (error) {
    logger.error("startCheckout could not open the session", { uid, plan, error: String(error) })
    throw new HttpsError("internal", "The store could not be reached")
  }
})

/**
 * Opens Stripe's billing portal, where a member cancels or changes their
 * card — the same contract as the native "Manage subscription" ✓.
 */
export const openBillingPortal = onCall({ secrets: [stripeSecret] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to manage your plan")
  const uid = request.auth.uid
  const config = await resolveStripeConfig()
  if (!config) throw new HttpsError("failed-precondition", "The store is not configured yet")

  const snapshot = await getFirestore().doc(`users/${uid}/entitlements/pro`).get()
  const customerId = String(snapshot.data()?.customerId ?? "")
  if (customerId.length === 0) {
    throw new HttpsError("failed-precondition", "There is no subscription to manage")
  }
  const origin = config.webOrigin ?? "https://setuno.vercel.app"
  try {
    const session = await createBillingPortalSession({
      config,
      customerId,
      returnUrl: `${origin}/settings/plan`,
    })
    return { url: session.url }
  } catch (error) {
    logger.error("openBillingPortal could not open the portal", { uid, error: String(error) })
    throw new HttpsError("internal", "The store could not be reached")
  }
})

/**
 * Stripe's webhook (the **web** half of the plan, roadmap #61).
 *
 * Stripe tells the server what happened; the server decides what that means
 * for the entitlement. The signature is checked against the **raw body**
 * (Stripe's HMAC covers the exact bytes it sent) and a stale timestamp is
 * refused, so a captured webhook cannot be replayed months later.
 *
 * The member's uid comes from the metadata Stripe stored with the
 * subscription — never from the browser — and a purchase without it grants
 * nothing at all.
 */
export const stripeWebhook = onRequest({ secrets: [stripeSecret] }, async (req, res) => {
  const config = await resolveStripeConfig()
  if (!config) {
    res.status(500).send("The store is not configured")
    return
  }
  const payload = req.rawBody ? req.rawBody.toString("utf8") : ""
  const header = req.headers["stripe-signature"]
  const signature = Array.isArray(header) ? header[0] : (header ?? null)
  if (!verifyStripeSignature({ payload, header: signature, secret: config.webhookSecret })) {
    res.status(400).send("Bad signature")
    return
  }

  const event = req.body as { type?: string; data?: { object?: Record<string, unknown> } }
  const object = event.data?.object ?? {}
  const type = event.type ?? ""

  try {
    if (type === "checkout.session.completed") {
      // The session carries the subscription; the subscription carries the
      // metadata that says whose it is.
      const subscriptionId = String(object.subscription ?? "")
      if (subscriptionId.length > 0) {
        const subscription = (await stripeApi(config, `subscriptions/${subscriptionId}`, {})) as Record<
          string,
          unknown
        >
        await settleStripeSubscription(config, subscription)
      }
    } else if (
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted"
    ) {
      await settleStripeSubscription(config, object)
    }
  } catch (error) {
    logger.error("stripeWebhook could not settle the subscription", { type, error: String(error) })
    res.status(500).send("Could not settle the subscription")
    return
  }

  res.status(200).send("ok")
})

/** Turns a Stripe subscription into the entitlement it means. */
const settleStripeSubscription = async (
  config: StripeConfig,
  subscription: Record<string, unknown>,
): Promise<void> => {
  const parsed = subscriptionFromStripe(subscription)
  if (!parsed) {
    // A subscription without our metadata is not ours: it grants nothing.
    logger.warn("stripeWebhook ignored a subscription without our metadata", {
      id: String(subscription.id ?? ""),
    })
    return
  }
  const now = new Date().toISOString().slice(0, 10)
  const entitlement: Entitlement = {
    plan: parsed.active ? "pro" : "free",
    productId: String(subscription.id ?? ""),
    source: "stripe",
    expiresAt: parsed.expiresAt,
    updatedAt: now,
    customerId: parsed.customerId,
    subscriptionId: parsed.subscriptionId,
  }
  // The plan belongs to the **band** the subscription was bought for.
  await getFirestore()
    .doc(`organizations/${parsed.organizationId}/entitlement/pro`)
    .set(entitlement, { merge: true })
  logger.info("stripeWebhook settled an entitlement", {
    uid: parsed.uid,
    organizationId: parsed.organizationId,
    plan: entitlement.plan,
    active: parsed.active,
  })
}

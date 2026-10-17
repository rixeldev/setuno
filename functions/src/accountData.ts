import type { DocumentData, Firestore } from "firebase-admin/firestore"

import { chunksOf } from "./purge"

/**
 * Account-level export and deletion (roadmap #68).
 *
 * Both halves are **callable-owned** and run through the Admin SDK, so neither
 * the export's reads nor the deletion's writes ever touch the security rules:
 * no `firestore.rules` change ships with this feature — the deploy it needs is
 * functions only.
 *
 * The export is delivered **inline**: `exportMyData` returns one indented JSON
 * string that the app hands to `libs/exportFile` (share sheet on native,
 * browser download on web). The roadmap sketched a download link; a link would
 * park the account's private data behind a URL with an expiry, while the inline
 * path reuses the file seam the song export already has and nothing outlives
 * the call.
 *
 * What a deletion takes and what it leaves is the whole design: the **band's**
 * content (songs, setlists, events, suggestions, activity) stays, because it
 * belongs to the band — only the *account* goes: every document under
 * `users/{uid}`, its username claim and the Auth user itself (deleting the
 * Auth user is the thin shell in `index.ts`, the `purge.ts` split, so this
 * module keeps testing against the Firestore emulator alone).
 *
 * `planOrgRemovals` is the pure planning core (unit-tested): a band left with
 * nobody in it is deleted whole, a band left without an admin promotes its
 * most senior member (the band must stay manageable), and a band whose owner
 * walks out hands `ownerId` over with it — `firestore.rules` pins the band's
 * delete to that uid, so a dangling owner would leave the band undeletable.
 * Everything that touches data is idempotent, because a caller that timed out
 * half way must be able to run the whole thing again.
 */

/** Callable responses cap at 10 MB; stay under with the indented JSON. */
export const ACCOUNT_EXPORT_BYTES_MAX = 9_000_000

/** Stamped inside the exported document; bumped only for a wholesale change. */
export const ACCOUNT_EXPORT_VERSION = 1

/** One export carries this many of the account's own activity events. */
const ACTIVITY_SLICE_MAX = 500

/** Firestore batches cap at 500 writes — same headroom as the purge. */
const WRITES_PER_BATCH = 400

/** `setuno-account-export-2026-10-17.json` — one name per day, no user data. */
export const accountExportFileName = (now: Date): string =>
  `setuno-account-export-${now.toISOString().slice(0, 10)}.json`

export interface RosterMember {
  uid: string
  /** `"admin"` is the only role that administers a band. */
  role: string
  /** `joinedAt` in epoch milliseconds; null when unknown (queued write). */
  joinedAt: number | null
}

export interface OrgRoster {
  orgId: string
  /** The band document's `ownerId`, even when the owner is already gone. */
  ownerId: string
  /** The whole roster, the departing member included (absent after a retry). */
  members: readonly RosterMember[]
}

export type OrgRemoval =
  | { orgId: string; action: "cascade" }
  | {
      orgId: string
      action: "leave"
      /** Promoted to admin when the leaver was the band's last one. */
      promoteUid: string | null
      /** Handed the band's `ownerId` when the owner is the one leaving. */
      transferOwnerTo: string | null
    }

/**
 * Succession order: earliest `joinedAt` first, unknown stamps last, the uid as
 * the deterministic tie-break — every server (and every test) agrees on who is
 * the most senior member of a band.
 */
const bySeniority = (a: RosterMember, b: RosterMember): number => {
  if (a.joinedAt !== null && b.joinedAt !== null) {
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt
  } else if (a.joinedAt !== b.joinedAt) {
    return a.joinedAt === null ? 1 : -1
  }
  if (a.uid === b.uid) return 0
  return a.uid < b.uid ? -1 : 1
}

const isAdmin = (member: RosterMember): boolean => member.role === "admin"

/**
 * What this member's exit does to each band they belong to:
 *
 * - nobody left → the whole band is deleted (a band with no members is a
 *   ghost, and Firestore does not clean it up by itself);
 * - the last admin left with members behind → the most senior member is
 *   promoted, otherwise the band has nobody who can manage it;
 * - the owner left with members behind → `ownerId` hands over to the
 *   promoted member, or to the most senior admin (or member) when no
 *   promotion was needed.
 *
 * The roster is read *before* anything is written, so the departing member's
 * own entry may already be gone on a retry — then nothing is promoted and the
 * owner keys still hand over, which is exactly what a first run interrupted
 * between those two writes needs.
 */
export const planOrgRemovals = (orgs: readonly OrgRoster[], uid: string): OrgRemoval[] =>
  orgs.map((org): OrgRemoval => {
    const remaining = org.members.filter((member) => member.uid !== uid)
    if (remaining.length === 0) return { orgId: org.orgId, action: "cascade" }

    const departing = org.members.find((member) => member.uid === uid)
    const ordered = [...remaining].sort(bySeniority)
    const admins = ordered.filter(isAdmin)
    const promoteUid =
      departing && isAdmin(departing) && admins.length === 0 ? ordered[0].uid : null
    const transferOwnerTo =
      org.ownerId === uid ? (promoteUid ?? admins[0]?.uid ?? ordered[0].uid) : null
    return { orgId: org.orgId, action: "leave", promoteUid, transferOwnerTo }
  })

/** The document as it reads in the export: its data plus the path's own id. */
const entryOf = (snapshot: { id: string; data: () => DocumentData }): DocumentData => ({
  ...snapshot.data(),
  id: snapshot.id,
})

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

const millisOf = (value: unknown): number | null => {
  if (typeof value === "number") return value
  const holder = value as { toMillis?: () => number } | null | undefined
  return holder && typeof holder.toMillis === "function" ? holder.toMillis() : null
}

/** Every document of one private subcollection, id included. */
const listPersonal = async (
  db: Firestore,
  uid: string,
  name: string,
): Promise<DocumentData[]> => {
  const snapshot = await db.collection(`users/${uid}/${name}`).get()
  return snapshot.docs.map(entryOf)
}

/**
 * Invitations addressed to this account, from any band — they live *outside*
 * `users/{uid}` (an invitation is the inviting band's document, keyed by the
 * invited email), which is why they are collected by their own
 * collection-group query. Both casings of the address are asked for and the
 * results de-duplicated by path, so a store that kept the original case is
 * found just like a normalised one.
 */
const collectInvitations = async (db: Firestore, email: string | null): Promise<DocumentData[]> => {
  const trimmed = typeof email === "string" ? email.trim() : ""
  if (trimmed.length === 0) return []
  const byPath = new Map<string, DocumentData>()
  for (const form of [...new Set([trimmed, trimmed.toLowerCase()])]) {
    const snapshot = await db.collectionGroup("invitations").where("email", "==", form).get()
    for (const invitation of snapshot.docs) {
      byPath.set(invitation.ref.path, {
        ...entryOf(invitation),
        organizationId: invitation.ref.parent.parent?.id ?? "",
      })
    }
  }
  return [...byPath.values()]
}

/** The export document itself: plain data, ready for `JSON.stringify`. */
export interface AccountExport {
  format: string
  version: number
  exportedAt: string
  profile: DocumentData | null
  username: string | null
  organizations: DocumentData[]
  favorites: DocumentData[]
  collections: DocumentData[]
  readerState: DocumentData[]
  annotations: DocumentData[]
  devices: DocumentData[]
  songs: DocumentData[]
  suggestions: DocumentData[]
  activity: DocumentData[]
  invitations: DocumentData[]
  counts: Record<string, number>
}

/**
 * Assembles this account's export: the profile and username claim, every band
 * it belongs to, **every song it can read** (member-readable means the whole
 * songbook of those bands, trash included — the trash filter is client-side),
 * but only its *own* suggestions and activity, because another member's words
 * belong to that member. Personal documents ride along in full: favorites,
 * collections, reader state, annotations, push devices, band mirrors and read
 * markers. Everything serializes through `JSON.stringify` untouched — the
 * documents hold ids and stamps, and a Firestore `Timestamp` renders itself as
 * an ISO string.
 */
export const collectAccountExport = async (
  db: Firestore,
  uid: string,
  email: string | null,
  now: Date,
): Promise<AccountExport> => {
  const profileSnapshot = await db.doc(`users/${uid}`).get()
  const profile = profileSnapshot.exists ? (profileSnapshot.data() ?? null) : null

  const claims = await db.collection("usernames").where("uid", "==", uid).limit(1).get()
  const username = claims.empty ? null : claims.docs[0].id

  const mirror = await db.collection(`users/${uid}/organizations`).get()

  const organizations: DocumentData[] = []
  const songs: DocumentData[] = []
  const suggestions: DocumentData[] = []
  const activity: DocumentData[] = []
  for (const mirrorEntry of mirror.docs) {
    const organizationId = mirrorEntry.id
    const organization = await db.doc(`organizations/${organizationId}`).get()
    const organizationData = organization.data() ?? {}
    const mirrorData = mirrorEntry.data()
    organizations.push({
      ...mirrorData,
      id: organizationId,
      name: textOf(organizationData.name) || textOf(mirrorData.name),
      ownerId: textOf(organizationData.ownerId),
    })

    const songSnapshot = await db.collection(`organizations/${organizationId}/songs`).get()
    for (const song of songSnapshot.docs) {
      songs.push({ ...entryOf(song), organizationId })
    }

    const suggestionSnapshot = await db
      .collection(`organizations/${organizationId}/suggestions`)
      .where("authorId", "==", uid)
      .get()
    for (const suggestion of suggestionSnapshot.docs) {
      suggestions.push({ ...entryOf(suggestion), organizationId })
    }

    const actionSnapshot = await db
      .collection(`organizations/${organizationId}/activity`)
      .where("actorId", "==", uid)
      .get()
    for (const event of actionSnapshot.docs) {
      activity.push({ ...entryOf(event), organizationId })
    }
  }

  // The account's own actions, newest first, capped so one loud band cannot
  // turn the export into a runaway payload.
  activity.sort((a, b) => (millisOf(b.createdAt) ?? 0) - (millisOf(a.createdAt) ?? 0))
  const activitySlice = activity.slice(0, ACTIVITY_SLICE_MAX)

  const favorites = await listPersonal(db, uid, "favorites")
  const collections = await listPersonal(db, uid, "collections")
  const readerState = await listPersonal(db, uid, "readerState")
  const annotations = await listPersonal(db, uid, "annotations")
  const devices = await listPersonal(db, uid, "devices")
  const invitations = await collectInvitations(db, email)

  return {
    format: "setuno-account-export",
    version: ACCOUNT_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    profile,
    username,
    organizations,
    favorites,
    collections,
    readerState,
    annotations,
    devices,
    songs,
    suggestions,
    activity: activitySlice,
    invitations,
    counts: {
      organizations: organizations.length,
      songs: songs.length,
      suggestions: suggestions.length,
      activity: activitySlice.length,
      favorites: favorites.length,
      collections: collections.length,
      readerState: readerState.length,
      annotations: annotations.length,
      devices: devices.length,
      invitations: invitations.length,
    },
  }
}

type DocRef = ReturnType<Firestore["doc"]>

const deleteRefs = async (db: Firestore, refs: readonly DocRef[]): Promise<void> => {
  for (const group of chunksOf(refs, WRITES_PER_BATCH)) {
    const batch = db.batch()
    for (const ref of group) batch.delete(ref)
    await batch.commit()
  }
}

/**
 * The document itself plus everything under it: each subcollection's documents
 * and *their* subcollections' documents — the deepest any current shape
 * reaches (`versions` under songs, `tasks` under performances, `comments`
 * under suggestions, `votes` under date polls). Firestore never cascades, so a
 * cascade is spelled out; one more nesting level than this would need saying
 * out loud here too.
 */
const documentTree = async (root: DocRef): Promise<DocRef[]> => {
  const refs: DocRef[] = [root]
  for (const subcollection of await root.listCollections()) {
    for (const document of await subcollection.listDocuments()) {
      refs.push(document)
      for (const nested of await document.listCollections()) {
        refs.push(...(await nested.listDocuments()))
      }
    }
  }
  return refs
}

export interface AccountDeletionSummary {
  /** Bands the account walked out of, still alive. */
  organizationsLeft: number
  /** Bands that had nobody else in them and were deleted whole. */
  organizationsDeleted: number
  /** Members promoted because the leaver was their band's last admin. */
  adminsPromoted: number
}

/**
 * The Firestore half of deleting an account: every band in the mirror is
 * planned through `planOrgRemovals` and applied (leave + succession, or the
 * whole band), the username claims keyed to this uid are released, and every
 * document under `users/{uid}` — profile included, which goes **last** so the
 * member-removal triggers of roadmap #52 still find the user while the exits
 * happen. The Auth user itself is deleted by the caller afterwards.
 *
 * Idempotent end to end: a second run finds the mirror gone (no bands to
 * walk), no claims, no private documents — every write is a delete of
 * something that may already be absent.
 */
export const deleteAccountData = async (
  db: Firestore,
  uid: string,
): Promise<AccountDeletionSummary> => {
  const mirror = await db.collection(`users/${uid}/organizations`).get()

  const rosters: OrgRoster[] = []
  const orgExists = new Map<string, boolean>()
  for (const entry of mirror.docs) {
    const organization = await db.doc(`organizations/${entry.id}`).get()
    const members = await db.collection(`organizations/${entry.id}/members`).get()
    orgExists.set(entry.id, organization.exists)
    rosters.push({
      orgId: entry.id,
      ownerId: textOf(organization.data()?.ownerId),
      members: members.docs.map((document): RosterMember => {
        const data = document.data()
        return { uid: document.id, role: textOf(data.role), joinedAt: millisOf(data.joinedAt) }
      }),
    })
  }

  let organizationsLeft = 0
  let organizationsDeleted = 0
  let adminsPromoted = 0

  for (const removal of planOrgRemovals(rosters, uid)) {
    const organizationRef = db.doc(`organizations/${removal.orgId}`)
    if (removal.action === "cascade") {
      if (orgExists.get(removal.orgId)) {
        await deleteRefs(db, await documentTree(organizationRef))
        organizationsDeleted += 1
      }
      continue
    }

    organizationsLeft += 1
    if (!orgExists.get(removal.orgId)) continue
    const batch = db.batch()
    batch.delete(db.doc(`organizations/${removal.orgId}/members/${uid}`))
    if (removal.promoteUid) {
      // The member document and their private band mirror both carry the
      // role, exactly like `services/organizations.ts#updateMemberRole` —
      // one of them alone would leave the band's own list out of step.
      batch.set(
        db.doc(`organizations/${removal.orgId}/members/${removal.promoteUid}`),
        { role: "admin" },
        { merge: true },
      )
      batch.set(
        db.doc(`users/${removal.promoteUid}/organizations/${removal.orgId}`),
        { role: "admin" },
        { merge: true },
      )
      adminsPromoted += 1
    }
    if (removal.transferOwnerTo) {
      batch.update(organizationRef, { ownerId: removal.transferOwnerTo })
    }
    await batch.commit()
  }

  // The claim registry is public: a released key is what lets the handle be
  // taken again (`services/usernames.ts` releases the old one on rename).
  const claims = await db.collection("usernames").where("uid", "==", uid).get()
  await deleteRefs(db, claims.docs.map((document) => document.ref))

  // Everything personal: mirrors, favorites, collections, reader state,
  // annotations, push devices, read markers — and the profile itself last.
  const userRef = db.doc(`users/${uid}`)
  await deleteRefs(db, await documentTree(userRef))

  return { organizationsLeft, organizationsDeleted, adminsPromoted }
}

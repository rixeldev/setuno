/**
 * Single low-level access point to Firestore for the whole app.
 *
 * Every feature service imports the Firebase primitives from here so there is
 * exactly one place that knows how Setuno talks to the database.
 *
 * On web, Metro swaps the underlying `@react-native-firebase/*` modules for the
 * Firebase JS SDK (see metro.config.js + shims/), so the same code runs on
 * Android and Web.
 */
import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  disableNetwork,
  doc,
  enableNetwork,
  getDoc,
  getDocs,
  getDocsFromServer,
  limit as limitTo,
  onSnapshot,
  onSnapshotsInSync,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  waitForPendingWrites,
  where,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
  type QuerySnapshot,
  type Unsubscribe,
} from "@react-native-firebase/firestore"

import type { FirebaseApp } from "@react-native-firebase/app"

import { app, auth } from "@/db/firebaseConfig"
import { createFirestore } from "@/db/firestoreInstance"

export {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  disableNetwork,
  doc,
  enableNetwork,
  getDoc,
  getDocs,
  getDocsFromServer,
  limitTo,
  onSnapshot,
  onSnapshotsInSync,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  waitForPendingWrites,
  where,
  writeBatch,
}

export type { DocumentData, DocumentSnapshot, QuerySnapshot, Unsubscribe }

/**
 * Notified when a live listener stops delivering data (offline, permission
 * denied, rules changed). Callers keep the last good snapshot and surface a
 * friendly message instead of silently emptying the screen.
 */
export type SubscribeErrorHandler = (error: Error) => void

/** Firestore instance shared by every service (from the shared Firebase app). */
export const firestore = createFirestore(app as FirebaseApp)

/** Firestore database paths, centralised to avoid typo-driven bugs. */
export const paths = {
  users: "users",
  user: (uid: string) => `users/${uid}`,
  /** Public claim registry: usernames/{lowercased, trimmed name}. */
  username: (name: string) => `usernames/${name}`,
  userOrganizations: (uid: string) => `users/${uid}/organizations`,
  userOrganization: (uid: string, orgId: string) => `users/${uid}/organizations/${orgId}`,
  /** Private per-song reader state (autoscroll today, scroll position later). */
  userReaderState: (uid: string, songId: string) => `users/${uid}/readerState/${songId}`,
  /** Private per-song personal notes (roadmap #3), owner-only. */
  userAnnotation: (uid: string, songId: string) => `users/${uid}/annotations/${songId}`,
  /** Personal read marker of a band's activity feed (roadmap #53). */
  userActivityRead: (uid: string, orgId: string) => `users/${uid}/activityRead/${orgId}`,
  /**
   * Push registrations (roadmap #52): one doc per install, the document id is
   * the Expo push token itself. Owner-only; Cloud Functions read it with the
   * Admin SDK, which bypasses the rules.
   */
  userDevices: (uid: string) => `users/${uid}/devices`,
  userDevice: (uid: string, deviceId: string) => `users/${uid}/devices/${deviceId}`,
  /** Personal favorite songs, one doc per star (roadmap #33), owner-only. */
  userFavorites: (uid: string) => `users/${uid}/favorites`,
  userFavorite: (uid: string, songId: string) => `users/${uid}/favorites/${songId}`,
  /** Private per-user collections, personal setlist drafts (roadmap #33). */
  userCollections: (uid: string) => `users/${uid}/collections`,
  userCollection: (uid: string, collectionId: string) => `users/${uid}/collections/${collectionId}`,
  organizations: "organizations",
  organization: (orgId: string) => `organizations/${orgId}`,
  // Opt-in directory entry (#60): exists only while the band chose to be found.
  discoverable: "discoverable",
  discoverableOrg: (orgId: string) => `discoverable/${orgId}`,
  members: (orgId: string) => `organizations/${orgId}/members`,
  member: (orgId: string, uid: string) => `organizations/${orgId}/members/${uid}`,
  songs: (orgId: string) => `organizations/${orgId}/songs`,
  song: (orgId: string, songId: string) => `organizations/${orgId}/songs/${songId}`,
  /** Saved states of a song's content, one per admin save (roadmap #26). */
  songVersions: (orgId: string, songId: string) =>
    `organizations/${orgId}/songs/${songId}/versions`,
  setlists: (orgId: string) => `organizations/${orgId}/setlists`,
  setlist: (orgId: string, setlistId: string) => `organizations/${orgId}/setlists/${setlistId}`,
  performances: (orgId: string) => `organizations/${orgId}/performances`,
  performance: (orgId: string, id: string) => `organizations/${orgId}/performances/${id}`,
  /** "Who brings what" tasks of one event (roadmap #47). */
  performanceTasks: (orgId: string, id: string) =>
    `organizations/${orgId}/performances/${id}/tasks`,
  performanceTask: (orgId: string, id: string, taskId: string) =>
    `organizations/${orgId}/performances/${id}/tasks/${taskId}`,
  /** Date polls and one availability doc per voting member (roadmap #48). */
  datePolls: (orgId: string) => `organizations/${orgId}/datePolls`,
  datePoll: (orgId: string, pollId: string) => `organizations/${orgId}/datePolls/${pollId}`,
  datePollVotes: (orgId: string, pollId: string) =>
    `organizations/${orgId}/datePolls/${pollId}/votes`,
  datePollVote: (orgId: string, pollId: string, uid: string) =>
    `organizations/${orgId}/datePolls/${pollId}/votes/${uid}`,
  /** Reusable checklists stamped onto events as #47 tasks (roadmap #49). */
  checklists: (orgId: string) => `organizations/${orgId}/checklists`,
  checklist: (orgId: string, checklistId: string) =>
    `organizations/${orgId}/checklists/${checklistId}`,
  suggestions: (orgId: string) => `organizations/${orgId}/suggestions`,
  suggestion: (orgId: string, id: string) => `organizations/${orgId}/suggestions/${id}`,
  /** Discussion comments on one suggestion (roadmap #55). */
  suggestionComments: (orgId: string, id: string) =>
    `organizations/${orgId}/suggestions/${id}/comments`,
  suggestionComment: (orgId: string, id: string, commentId: string) =>
    `organizations/${orgId}/suggestions/${id}/comments/${commentId}`,
  activity: (orgId: string) => `organizations/${orgId}/activity`,
  activityEvent: (orgId: string, id: string) => `organizations/${orgId}/activity/${id}`,
  invitations: (orgId: string) => `organizations/${orgId}/invitations`,
  invitation: (orgId: string, id: string) => `organizations/${orgId}/invitations/${id}`,
  joinRequests: (orgId: string) => `organizations/${orgId}/joinRequests`,
  joinRequest: (orgId: string, uid: string) => `organizations/${orgId}/joinRequests/${uid}`,
  /**
   * Public share snapshots (roadmap #56), keyed by their unguessable token —
   * readable by anyone holding the exact id, unreachable by listing.
   */
  share: (token: string) => `shares/${token}`,
} as const

/** Currently signed-in uid, or null when signed out. */
export const currentUserId = (): string | null => auth.currentUser?.uid ?? null

/** Throws when an operation requires authentication. */
export const requireUserId = (): string => {
  const uid = currentUserId()
  if (!uid) throw new Error("You need to be signed in to do that.")
  return uid
}

/** Removes `undefined` entries so Firestore never rejects a write. */
export const clean = <T extends Record<string, unknown>>(value: T): T => {
  const result: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) result[key] = entry
  }
  return result as T
}

/** Maps a document snapshot to a domain object, or null when it is missing. */
export const mapDoc = <T>(
  snapshot: DocumentSnapshot,
  mapper: (data: DocumentData, id: string) => T,
): T | null => (snapshot.exists() ? mapper(snapshot.data() as DocumentData, snapshot.id) : null)

/** Maps every document of a query snapshot to a domain object. */
export const mapDocs = <T>(
  snapshot: QuerySnapshot,
  mapper: (data: DocumentData, id: string) => T,
): T[] => snapshot.docs.map((item) => mapper(item.data() as DocumentData, item.id))

/** Normalises an email for storage/comparison. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase()

/** Firestore allows most characters in ids; emails need "/" escaped. */
export const emailToDocId = (email: string): string => normalizeEmail(email).replace(/\//g, "%2F")
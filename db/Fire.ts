/**
 * Single low-level access point to Firestore for the whole app.
 *
 * Every feature service imports the Firebase primitives from here so there is
 * exactly one place that knows how Stage Book talks to the database.
 *
 * On web, Metro swaps the underlying `@react-native-firebase/*` modules for the
 * Firebase JS SDK (see metro.config.js + shims/), so the same code runs on
 * Android and Web.
 */
import {
  Timestamp,
  collection,
  collectionGroup,
  deleteDoc,
  disableNetwork,
  doc,
  enableNetwork,
  getDoc,
  getDocs,
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
  collection,
  collectionGroup,
  deleteDoc,
  disableNetwork,
  doc,
  enableNetwork,
  getDoc,
  getDocs,
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
  userOrganizations: (uid: string) => `users/${uid}/organizations`,
  userOrganization: (uid: string, orgId: string) => `users/${uid}/organizations/${orgId}`,
  organizations: "organizations",
  organization: (orgId: string) => `organizations/${orgId}`,
  members: (orgId: string) => `organizations/${orgId}/members`,
  member: (orgId: string, uid: string) => `organizations/${orgId}/members/${uid}`,
  songs: (orgId: string) => `organizations/${orgId}/songs`,
  song: (orgId: string, songId: string) => `organizations/${orgId}/songs/${songId}`,
  setlists: (orgId: string) => `organizations/${orgId}/setlists`,
  setlist: (orgId: string, setlistId: string) => `organizations/${orgId}/setlists/${setlistId}`,
  performances: (orgId: string) => `organizations/${orgId}/performances`,
  performance: (orgId: string, id: string) => `organizations/${orgId}/performances/${id}`,
  suggestions: (orgId: string) => `organizations/${orgId}/suggestions`,
  suggestion: (orgId: string, id: string) => `organizations/${orgId}/suggestions/${id}`,
  activity: (orgId: string) => `organizations/${orgId}/activity`,
  activityEvent: (orgId: string, id: string) => `organizations/${orgId}/activity/${id}`,
  invitations: (orgId: string) => `organizations/${orgId}/invitations`,
  invitation: (orgId: string, id: string) => `organizations/${orgId}/invitations/${id}`,
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
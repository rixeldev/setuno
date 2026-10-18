import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  firestore,
  getDocs,
  limitTo,
  mapDoc,
  mapDocs,
  normalizeEmail,
  onSnapshot,
  orderBy,
  paths,
  query,
  requireUserId,
  setDoc,
  updateDoc,
  where,
  type SubscribeErrorHandler,
  type Unsubscribe,
} from "@/db/Fire"
import { directoryNameKey, joinRequestNote, normalizeJoinRequestStatus } from "@/libs/joinRequests"
import { ValidationError } from "@/services/errors"
import { createInvitation } from "@/services/organizations"
import type {
  DiscoverableOrganization,
  JoinRequest,
  JoinRequestStatus,
  OrganizationRole,
} from "@/interfaces"

const mapJoinRequest = (
  data: Record<string, unknown>,
  id: string,
  organizationId: string,
): JoinRequest => ({
  uid: id,
  organizationId,
  displayName: String(data.displayName ?? ""),
  email: String(data.email ?? ""),
  note: String(data.note ?? ""),
  status: normalizeJoinRequestStatus(data.status),
  createdAt: data.createdAt as JoinRequest["createdAt"],
  reviewedBy: typeof data.reviewedBy === "string" ? data.reviewedBy : null,
  reviewedByName: typeof data.reviewedByName === "string" ? data.reviewedByName : null,
  reviewedAt: (data.reviewedAt as JoinRequest["reviewedAt"]) ?? null,
})

const mapDiscoverable = (
  data: Record<string, unknown>,
  id: string,
): DiscoverableOrganization => ({
  id,
  name: String(data.name ?? ""),
})

/**
 * Exact-name lookup over the opt-in directory (roadmap #60).
 *
 * Equality only — a prefix query would let anybody enumerate every band that
 * said yes, and the rules deny `orderBy` outright — and one shot, so no
 * standing subscription ever watches the directory. An empty query means
 * "nothing to look for" and never runs.
 */
export const searchDiscoverableBands = async (
  name: string,
): Promise<DiscoverableOrganization[]> => {
  const key = directoryNameKey(name)
  if (!key) return []
  const snapshot = await getDocs(
    query(
      collection(firestore, paths.discoverable),
      where("nameKey", "==", key),
      limitTo(10),
    ),
  )
  return mapDocs(snapshot, mapDiscoverable)
}

/** Sends the ask: the requester's own name, email and note are all it carries. */
export const createJoinRequest = async (input: {
  organizationId: string
  displayName: string
  email: string
  note: string
}): Promise<void> => {
  const uid = requireUserId()
  const displayName = input.displayName.trim()
  if (displayName.length === 0) {
    throw new ValidationError("We need a name to show the band's admins.")
  }
  const email = normalizeEmail(input.email)
  if (!email.includes("@")) throw new ValidationError("Enter a valid email address.")

  await setDoc(doc(firestore, paths.joinRequest(input.organizationId, uid)), {
    uid,
    displayName,
    email,
    note: joinRequestNote(input.note),
    // Client time, like #47's tasks: an offline ask keeps its place in the
    // admin's "newest first" queue the moment it lands.
    createdAt: new Date(),
    status: "pending",
  })
}

/** Withdraws the ask — a plain delete; asking again simply re-creates it. */
export const deleteJoinRequest = async (
  organizationId: string,
  requesterUid: string,
): Promise<void> => {
  await deleteDoc(doc(firestore, paths.joinRequest(organizationId, requesterUid)))
}

/** Live view of the caller's own ask in one band. */
export const subscribeMyJoinRequest = (
  organizationId: string | null,
  requesterUid: string | null,
  onChange: (request: JoinRequest | null) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId || !requesterUid) {
    onChange(null)
    return () => undefined
  }
  return onSnapshot(
    doc(firestore, paths.joinRequest(organizationId, requesterUid)),
    (snapshot) => onChange(mapDoc(snapshot, (data, id) => mapJoinRequest(data, id, organizationId))),
    (error) => onError?.(error),
  )
}

/**
 * The caller's asks across every band — the `subscribeMyInvitations` shape.
 * The band id rides in from the document path (it is never stored inside the
 * ask), so one listener can drive every row of the search results.
 */
export const subscribeMyJoinRequests = (
  requesterUid: string | null,
  onChange: (requests: JoinRequest[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  if (!requesterUid) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    query(
      collectionGroup(firestore, "joinRequests"),
      where("uid", "==", requesterUid),
      limitTo(20),
    ),
    (snapshot) =>
      onChange(
        snapshot.docs.map((entry) =>
          mapJoinRequest(
            entry.data() as Record<string, unknown>,
            entry.id,
            entry.ref.parent.parent?.id ?? "",
          ),
        ),
      ),
    (error) => onError?.(error),
  )
}

/** Admins' live queue of asks, newest first. */
export const subscribeJoinRequests = (
  organizationId: string | null,
  onChange: (requests: JoinRequest[]) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    query(collection(firestore, paths.joinRequests(organizationId)), orderBy("createdAt", "desc")),
    (snapshot) =>
      onChange(
        snapshot.docs.map((entry) => mapJoinRequest(entry.data() as Record<string, unknown>, entry.id, organizationId)),
      ),
    (error) => onError?.(error),
  )
}

const reviewStamp = (
  status: JoinRequestStatus,
  actor: { id: string; name: string },
): Record<string, unknown> => ({
  status,
  reviewedBy: actor.id,
  reviewedByName: actor.name,
  reviewedAt: new Date(),
})

/**
 * Approving turns the ask into the band's ordinary invitation, so membership
 * keeps the one rule it has always had — the requester accepts the invitation
 * themselves, with the usual push and zero new functions. The invitation goes
 * out first: retrying after a mid-flight failure only re-stamps documents that
 * already carry the same outcome.
 */
export const approveJoinRequest = async (
  organizationId: string,
  request: JoinRequest,
  role: OrganizationRole,
  actor: { id: string; name: string },
): Promise<void> => {
  await createInvitation(organizationId, request.email, role, actor)
  await updateDoc(
    doc(firestore, paths.joinRequest(organizationId, request.uid)),
    reviewStamp("approved", actor),
  )
}

/** Rejecting only stamps the ask: the requester may ask again later. */
export const rejectJoinRequest = async (
  organizationId: string,
  request: JoinRequest,
  actor: { id: string; name: string },
): Promise<void> => {
  await updateDoc(
    doc(firestore, paths.joinRequest(organizationId, request.uid)),
    reviewStamp("rejected", actor),
  )
}

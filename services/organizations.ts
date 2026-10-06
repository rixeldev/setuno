import {
  clean,
  collection,
  collectionGroup,
  doc,
  deleteDoc,
  emailToDocId,
  firestore,
  getDoc,
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
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type SubscribeErrorHandler,
  type Unsubscribe,
} from "@/db/Fire"
import {
  ROLE_LABELS,
  type Invitation,
  type Organization,
  type OrganizationInput,
  type OrganizationMember,
  type OrganizationRef,
  type OrganizationRole,
} from "@/interfaces"
import { logActivity } from "@/services/activity"
import { ValidationError } from "@/services/errors"

const mapOrganization = (data: Record<string, unknown>, id: string): Organization =>
  ({
    id,
    name: String(data.name ?? ""),
    description: String(data.description ?? ""),
    logoURL: (data.logoURL as string | null) ?? null,
    ownerId: String(data.ownerId ?? ""),
    createdAt: data.createdAt as Organization["createdAt"],
    updatedAt: data.updatedAt as Organization["updatedAt"],
  }) as Organization

const mapMember = (data: Record<string, unknown>, id: string): OrganizationMember =>
  ({
    uid: id,
    displayName: String(data.displayName ?? ""),
    email: String(data.email ?? ""),
    photoURL: (data.photoURL as string | null) ?? null,
    role: (data.role as OrganizationRole) === "admin" ? "admin" : "member",
    joinedAt: data.joinedAt as OrganizationMember["joinedAt"],
    invitedBy: (data.invitedBy as string | null) ?? null,
  }) as OrganizationMember

const mapInvitation = (data: Record<string, unknown>, id: string): Invitation =>
  ({
    id,
    organizationId: String(data.organizationId ?? ""),
    organizationName: String(data.organizationName ?? ""),
    email: String(data.email ?? ""),
    role: (data.role as OrganizationRole) === "admin" ? "admin" : "member",
    status: (data.status as Invitation["status"]) ?? "pending",
    invitedBy: String(data.invitedBy ?? ""),
    invitedByName: String(data.invitedByName ?? ""),
    createdAt: data.createdAt as Invitation["createdAt"],
    respondedAt: (data.respondedAt as Invitation["respondedAt"]) ?? null,
  }) as Invitation

const mapOrganizationRef = (data: Record<string, unknown>, id: string): OrganizationRef => ({
  id,
  name: String(data.name ?? ""),
  role: (data.role as OrganizationRole) === "admin" ? "admin" : "member",
  logoURL: (data.logoURL as string | null) ?? null,
})

/* -------------------------------------------------------------------------- */
/* Organizations                                                              */
/* -------------------------------------------------------------------------- */

export interface CreateOrganizationInput extends OrganizationInput {
  ownerName: string
}

export const createOrganization = async (input: CreateOrganizationInput): Promise<string> => {
  const uid = requireUserId()
  const name = input.name.trim()
  if (name.length < 2) throw new ValidationError("Organization name must be at least 2 characters.")
  if (name.length > 60) throw new ValidationError("Organization name is too long.")

  const organizationRef = doc(collection(firestore, paths.organizations))
  const organizationId = organizationRef.id
  const now = serverTimestamp()

  const batch = writeBatch(firestore)
  batch.set(organizationRef, {
    name,
    description: input.description.trim(),
    logoURL: input.logoURL ?? null,
    ownerId: uid,
    createdAt: now,
    updatedAt: now,
  })
  batch.set(doc(firestore, paths.member(organizationId, uid)), {
    uid,
    displayName: input.ownerName.trim() || "Owner",
    email: "",
    photoURL: null,
    role: "admin",
    joinedAt: now,
    invitedBy: null,
  })
  batch.set(doc(firestore, paths.userOrganization(uid, organizationId)), {
    name,
    role: "admin",
    logoURL: input.logoURL ?? null,
    joinedAt: now,
  })
  await batch.commit()

  void logActivity({
    organizationId,
    type: "organization_created",
    message: `${input.ownerName.trim() || "You"} created "${name}"`,
    actorId: uid,
    actorName: input.ownerName.trim() || "You",
    targetType: "organization",
    targetId: organizationId,
  })

  return organizationId
}

export const updateOrganization = async (
  organizationId: string,
  input: OrganizationInput,
  actor: { id: string; name: string },
): Promise<void> => {
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() }
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (name.length < 2) throw new ValidationError("Organization name must be at least 2 characters.")
    patch.name = name
  }
  if (input.description !== undefined) patch.description = input.description.trim()
  if (input.logoURL !== undefined) patch.logoURL = input.logoURL

  await updateDoc(doc(firestore, paths.organization(organizationId)), clean(patch))
  void logActivity({
    organizationId,
    type: "organization_updated",
    message: `${actor.name} updated the organization details`,
    actorId: actor.id,
    actorName: actor.name,
    targetType: "organization",
    targetId: organizationId,
  })
}

/** Removes the organization and every sub-collection it owns. */
export const deleteOrganization = async (organizationId: string): Promise<void> => {
  const batch = writeBatch(firestore)
  const subCollections = [
    paths.members(organizationId),
    paths.songs(organizationId),
    paths.setlists(organizationId),
    paths.performances(organizationId),
    paths.suggestions(organizationId),
    paths.activity(organizationId),
    paths.invitations(organizationId),
  ]

  for (const path of subCollections) {
    const snapshot = await getDocs(collection(firestore, path))
    for (const item of snapshot.docs) batch.delete(item.ref)
  }

  const members = await getDocs(collection(firestore, paths.members(organizationId)))
  for (const member of members.docs) {
    batch.delete(doc(firestore, paths.userOrganization(member.id, organizationId)))
  }

  batch.delete(doc(firestore, paths.organization(organizationId)))
  await batch.commit()
}

export const fetchOrganization = async (
  organizationId: string,
): Promise<Organization | null> => {
  const snapshot = await getDoc(doc(firestore, paths.organization(organizationId)))
  return mapDoc(snapshot, mapOrganization)
}

/** Live organization document (name, description, logo...). */
export const subscribeOrganization = (
  organizationId: string | null,
  onChange: (organization: Organization | null) => void,
): Unsubscribe => {
  if (!organizationId) {
    onChange(null)
    return () => undefined
  }
  return onSnapshot(
    doc(firestore, paths.organization(organizationId)),
    (snapshot) => onChange(mapDoc(snapshot, mapOrganization)),
    () => onChange(null),
  )
}

/* -------------------------------------------------------------------------- */
/* Membership                                                                  */
/* -------------------------------------------------------------------------- */

export const subscribeMembers = (
  organizationId: string | null,
  onChange: (members: OrganizationMember[]) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    query(collection(firestore, paths.members(organizationId)), orderBy("displayName")),
    (snapshot) => onChange(mapDocs(snapshot, mapMember)),
    (error) => onError?.(error),
  )
}

export const fetchMember = async (
  organizationId: string,
  uid: string,
): Promise<OrganizationMember | null> => {
  const snapshot = await getDoc(doc(firestore, paths.member(organizationId, uid)))
  return mapDoc(snapshot, mapMember)
}

/** Lightweight role lookup used by admin-only UI and guards. */
export const fetchMemberRole = async (
  organizationId: string,
  uid: string,
): Promise<OrganizationRole | null> => {
  const snapshot = await getDoc(doc(firestore, paths.member(organizationId, uid)))
  if (!snapshot.exists()) return null
  const data = snapshot.data() as { role?: OrganizationRole }
  return data.role === "admin" ? "admin" : "member"
}

/**
 * Adds a musician to the band by email.
 *
 * Membership is always granted through an invitation document keyed by the
 * lowercased email: the invitee accepts it with their own authenticated identity,
 * which is what the security rules require (and it means nobody can add another
 * person's account for them). Already-accepted invitations for the same address
 * are replaced so re-inviting always works.
 */
export const addMemberByEmail = async (
  organizationId: string,
  email: string,
  role: OrganizationRole,
  actor: { id: string; name: string },
): Promise<{ joined: boolean; invited: boolean }> => {
  await createInvitation(organizationId, email, role, actor)
  return { joined: false, invited: true }
}

export const updateMemberRole = async (
  organizationId: string,
  memberUid: string,
  role: OrganizationRole,
  actor: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  const batch = writeBatch(firestore)
  batch.set(doc(firestore, paths.member(organizationId, memberUid)), { role }, { merge: true })
  batch.set(
    doc(firestore, paths.userOrganization(memberUid, organizationId)),
    { role },
    { merge: true },
  )
  await batch.commit()

  void logActivity({
    organizationId,
    type: "member_role_changed",
    message: `${actor.name} changed a member role to ${ROLE_LABELS[role]}`,
    actorId: uid,
    actorName: actor.name,
    targetType: "member",
    targetId: memberUid,
  })
}

export const removeMember = async (
  organizationId: string,
  memberUid: string,
  actor: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  if (memberUid === uid) throw new ValidationError("You can't remove yourself from the band.")

  const member = await fetchMember(organizationId, memberUid)
  const batch = writeBatch(firestore)
  batch.delete(doc(firestore, paths.member(organizationId, memberUid)))
  batch.delete(doc(firestore, paths.userOrganization(memberUid, organizationId)))
  await batch.commit()

  void logActivity({
    organizationId,
    type: "member_removed",
    message: `${actor.name} removed ${member?.displayName || "a member"}`,
    actorId: uid,
    actorName: actor.name,
    targetType: "member",
    targetId: memberUid,
  })
}

/** Live list of the organizations a user belongs to (drives the org switcher). */
export const subscribeMyOrganizations = (
  uid: string | null,
  onChange: (organizations: OrganizationRef[]) => void,
): Unsubscribe => {
  if (!uid) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    collection(firestore, paths.userOrganizations(uid)),
    (snapshot) => onChange(mapDocs(snapshot, mapOrganizationRef)),
    () => onChange([]),
  )
}

/* -------------------------------------------------------------------------- */
/* Invitations (secure join flow, docs §43)                                     */
/* -------------------------------------------------------------------------- */

export const createInvitation = async (
  organizationId: string,
  email: string,
  role: OrganizationRole,
  actor: { id: string; name: string },
): Promise<Invitation> => {
  const uid = requireUserId()
  const normalized = normalizeEmail(email)
  if (normalized.length === 0) throw new ValidationError("Enter an email address.")
  if (!normalized.includes("@")) throw new ValidationError("Enter a valid email address.")

  const organization = await fetchOrganization(organizationId)
  const reference = doc(firestore, paths.invitation(organizationId, emailToDocId(normalized)))
  const payload = {
    organizationId,
    organizationName: organization?.name ?? "",
    email: normalized,
    role,
    status: "pending",
    invitedBy: uid,
    invitedByName: actor.name,
    createdAt: serverTimestamp(),
    respondedAt: null,
  }
  // merge: re-inviting somebody who already accepted works without wiping fields
  // other writers may have added.
  await setDoc(reference, payload, { merge: true })

  void logActivity({
    organizationId,
    type: "invitation_sent",
    message: `${actor.name} invited ${normalized} to join`,
    actorId: uid,
    actorName: actor.name,
    targetType: "organization",
    targetId: organizationId,
  })

  return mapInvitation({ ...payload, createdAt: serverTimestamp() }, reference.id) as Invitation
}

export const revokeInvitation = async (
  organizationId: string,
  email: string,
  actor: { id: string; name: string },
): Promise<void> => {
  const uid = requireUserId()
  await deleteDoc(doc(firestore, paths.invitation(organizationId, emailToDocId(email))))
  void logActivity({
    organizationId,
    type: "invitation_revoked",
    message: `${actor.name} revoked an invitation`,
    actorId: uid,
    actorName: actor.name,
    targetType: "organization",
    targetId: organizationId,
  })
}

export const subscribeInvitations = (
  organizationId: string | null,
  onChange: (invitations: Invitation[]) => void,
  onError?: SubscribeErrorHandler,
): Unsubscribe => {
  if (!organizationId) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    query(collection(firestore, paths.invitations(organizationId)), orderBy("createdAt", "desc")),
    (snapshot) =>
      onChange(mapDocs(snapshot, mapInvitation).filter((invitation) => invitation.status === "pending")),
    (error) => onError?.(error),
  )
}

export const fetchInvitation = async (
  organizationId: string,
  email: string,
): Promise<Invitation | null> => {
  const snapshot = await getDoc(doc(firestore, paths.invitation(organizationId, emailToDocId(email))))
  return mapDoc(snapshot, mapInvitation)
}

/**
 * Accepts an invitation: creates the membership plus the user's organization
 * index entry. Firestore rules verify the invitation belongs to the caller, so
 * an email match alone never grants access.
 */
export const acceptInvitation = async (
  invitation: Invitation,
  member: { displayName: string; photoURL: string | null; email: string },
): Promise<void> => {
  const uid = requireUserId()
  const now = serverTimestamp()
  const batch = writeBatch(firestore)
  batch.set(doc(firestore, paths.member(invitation.organizationId, uid)), {
    uid,
    displayName: member.displayName,
    email: normalizeEmail(member.email),
    photoURL: member.photoURL,
    role: invitation.role,
    joinedAt: now,
    invitedBy: invitation.invitedBy,
  })
  batch.set(doc(firestore, paths.userOrganization(uid, invitation.organizationId)), {
    name: invitation.organizationName,
    role: invitation.role,
    logoURL: null,
    joinedAt: now,
  })
  batch.update(doc(firestore, paths.invitation(invitation.organizationId, invitation.id)), {
    status: "accepted",
    respondedAt: now,
  })
  await batch.commit()

  void logActivity({
    organizationId: invitation.organizationId,
    type: "invitation_accepted",
    message: `${member.displayName || member.email} joined the band`,
    actorId: uid,
    actorName: member.displayName || member.email,
    targetType: "member",
    targetId: uid,
  })
}

/**
 * Invitations addressed to the signed-in user's own email, across every
 * organization. Uses a collection group query so an invitee can be found
 * without knowing which organization invited them. Errors are surfaced to the
 * caller (permission denied usually means the rules are not deployed yet).
 */
export const subscribeMyInvitations = (
  email: string | null,
  onChange: (invitations: Invitation[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  if (!email) {
    onChange([])
    return () => undefined
  }
  return onSnapshot(
    query(collectionGroup(firestore, "invitations"), where("email", "==", normalizeEmail(email)), limitTo(20)),
    (snapshot) =>
      onChange(mapDocs(snapshot, mapInvitation).filter((invitation) => invitation.status === "pending")),
    (error) => onError?.(error),
  )
}
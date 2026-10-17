import type { OrganizationRole } from "@/interfaces"

/** Every role a band membership can carry. */
export const ORGANIZATION_ROLES: readonly OrganizationRole[] = ["admin", "member", "guest"]

/**
 * Stored roles arrive from untrusted documents, so anything unrecognised reads
 * back as `member` — invalid stored data self-heals on read, exactly like
 * `normalizeSongStatus` (roadmap #30).
 *
 * `guest` is the read-only role (roadmap #59): substitutes and techs who read
 * the band's songs, setlists and events but never write, suggest or see the
 * activity feed.
 */
export const normalizeRole = (value: unknown): OrganizationRole =>
  value === "admin" || value === "guest" ? value : "member"

/** An admin edits the band itself: songs, setlists, events, members, settings. */
export const canEditBand = (role: OrganizationRole | null): boolean => role === "admin"

/**
 * A collaborator takes part in the band's life beyond reading it:
 * suggestions and their comments, date polls, the "who brings what" logistics
 * (tasks and attendance) and the public live-setlist pointer. A guest is
 * deliberately outside all of it — that boundary is what the security rules
 * enforce, and these helpers are the UI's half of the same line.
 */
export const canCollaborate = (role: OrganizationRole | null): boolean =>
  role === "admin" || role === "member"

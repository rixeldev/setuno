import type { OrganizationMember } from "@/interfaces/organization"

/**
 * The band's instruments and jobs — the catalogue a member picks from, and the
 * one a song's line-up is written in.
 *
 * The list is **fixed and translated** on purpose: a band that invents its own
 * names ("sección de vientos") would read them untranslated in the other three
 * languages, and the same word would have to be re-typed for every band. What a
 * member plays lives on their membership (`OrganizationMember.instruments`), so
 * the same account can be the drummer in one band and the singer in another.
 *
 * Ids are **stable strings**, never positions: a role added later on does not
 * move the ones already stored, and one removed heals away on read.
 */
export interface BandRole {
  id: string
  /** Translation key, under the `bandRoles` namespace. */
  labelKey: string
}

/** Ordered by family (voices, strings, keys, rhythm, winds, jobs) and then by
 * how often a band reaches for it, so the chip list reads sensibly. */
export const BAND_ROLES: readonly BandRole[] = [
  { id: "leadVocal", labelKey: "bandRoles.leadVocal" },
  { id: "backingVocal", labelKey: "bandRoles.backingVocal" },
  { id: "choir", labelKey: "bandRoles.choir" },
  { id: "guitar", labelKey: "bandRoles.guitar" },
  { id: "bass", labelKey: "bandRoles.bass" },
  { id: "ukulele", labelKey: "bandRoles.ukulele" },
  { id: "violin", labelKey: "bandRoles.violin" },
  { id: "cello", labelKey: "bandRoles.cello" },
  { id: "banjo", labelKey: "bandRoles.banjo" },
  { id: "mandolin", labelKey: "bandRoles.mandolin" },
  { id: "piano", labelKey: "bandRoles.piano" },
  { id: "keys", labelKey: "bandRoles.keys" },
  { id: "organ", labelKey: "bandRoles.organ" },
  { id: "accordion", labelKey: "bandRoles.accordion" },
  { id: "drums", labelKey: "bandRoles.drums" },
  { id: "percussion", labelKey: "bandRoles.percussion" },
  { id: "cajon", labelKey: "bandRoles.cajon" },
  { id: "saxophone", labelKey: "bandRoles.saxophone" },
  { id: "trumpet", labelKey: "bandRoles.trumpet" },
  { id: "trombone", labelKey: "bandRoles.trombone" },
  { id: "clarinet", labelKey: "bandRoles.clarinet" },
  { id: "flute", labelKey: "bandRoles.flute" },
  { id: "harmonica", labelKey: "bandRoles.harmonica" },
  { id: "dj", labelKey: "bandRoles.dj" },
  { id: "mc", labelKey: "bandRoles.mc" },
  { id: "director", labelKey: "bandRoles.director" },
  { id: "sound", labelKey: "bandRoles.sound" },
  { id: "lighting", labelKey: "bandRoles.lighting" },
]

const ROLE_BY_ID = new Map(BAND_ROLES.map((role, index) => [role.id, { role, index }]))

/** How many roles one member may declare ("I sing and play guitar"). */
export const MAX_MEMBER_ROLES = 8

/**
 * How many members one song's line-up may name. The roster is
 * invitation-bounded, so this only exists to keep the stored map honest — the
 * rules cannot iterate a map (the `attendance`/`markers` precedent).
 */
export const MAX_SONG_LINEUP = 100

export const isBandRole = (id: unknown): id is string =>
  typeof id === "string" && ROLE_BY_ID.has(id)

/**
 * The catalogue position of a role — the order line-ups and chips are shown in.
 * An unknown id sorts last instead of jumping to the front.
 */
export const bandRoleOrder = (id: string): number => ROLE_BY_ID.get(id)?.index ?? BAND_ROLES.length

type Translate = (key: string, options?: Record<string, unknown>) => string

/** The translated name of a role, or `""` when it is not in the catalogue. */
export const bandRoleLabel = (id: string, t: Translate): string => {
  const entry = ROLE_BY_ID.get(id)
  return entry ? t(entry.role.labelKey) : ""
}

/**
 * A member's roles, healed and ordered: unknown ids dropped (a role the app no
 * longer offers cannot shadow the ones it does), duplicates collapsed, and the
 * list read in catalogue order so the same member looks the same everywhere.
 */
export const sanitizeRoleIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  const unique = new Set<string>()
  for (const entry of value) {
    if (isBandRole(entry)) unique.add(entry)
  }
  return [...unique].sort((first, second) => bandRoleOrder(first) - bandRoleOrder(second)).slice(0, MAX_MEMBER_ROLES)
}

/** The translated names of a member's roles, in catalogue order. */
export const roleLabels = (ids: readonly string[], t: Translate): string[] =>
  ids.map((id) => bandRoleLabel(id, t)).filter((label) => label.length > 0)

/** A member's declared roles as one readable line ("Guitarra · Coros"). */
export const memberRolesLabel = (member: OrganizationMember, t: Translate): string =>
  roleLabels(sanitizeRoleIds(member.instruments), t).join(" · ")

/**
 * One song's line-up: **member uid → role id**. A member is named once (one
 * role per song), and nothing stops two members from sharing a role — two
 * guitarists on the same song are a real thing.
 *
 * Rules cannot iterate a map, so this is where a stored line-up heals: an
 * unknown role, a blank uid or a broken value simply is not there.
 */
export const cleanLineup = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const lineup: Record<string, string> = {}
  for (const [uid, role] of Object.entries(value as Record<string, unknown>)) {
    if (uid.trim().length === 0 || !isBandRole(role)) continue
    lineup[uid] = role
    if (Object.keys(lineup).length >= MAX_SONG_LINEUP) break
  }
  return lineup
}

/** A line-up entry resolved against the live roster, ready to render. */
export interface LineupEntry {
  uid: string
  name: string
  role: string
  photoURL: string | null
}

/**
 * A song's line-up against the band's current roster, ordered by role and then
 * by name so the list can never shuffle between renders.
 *
 * A member who left the band drops out: their uid no longer names anybody and
 * showing an empty slot would be worse than showing the band that plays the
 * song tonight.
 */
export const resolveLineup = (
  lineup: Record<string, string>,
  members: readonly OrganizationMember[],
): LineupEntry[] => {
  const byUid = new Map(members.map((member) => [member.uid, member]))
  const entries: LineupEntry[] = []
  for (const [uid, role] of Object.entries(lineup)) {
    const member = byUid.get(uid)
    if (!member) continue
    entries.push({
      uid,
      name: member.displayName.trim().length > 0 ? member.displayName : member.email,
      role,
      photoURL: member.photoURL,
    })
  }
  return entries.sort((first, second) => {
    const byRole = bandRoleOrder(first.role) - bandRoleOrder(second.role)
    if (byRole !== 0) return byRole
    const left = first.name.toLowerCase()
    const right = second.name.toLowerCase()
    if (left < right) return -1
    if (left > right) return 1
    return first.uid < second.uid ? -1 : first.uid > second.uid ? 1 : 0
  })
}

/**
 * The line-up as one line of text — "Voz principal: Julia · Guitarra: Manuel" —
 * for the running order, the reader and the printed sheet.
 *
 * The pair is translated rather than concatenated here, so a language can order
 * the two halves its own way.
 */
export const lineupSummary = (entries: readonly LineupEntry[], t: Translate): string =>
  entries
    .filter((entry) => bandRoleLabel(entry.role, t).length > 0)
    .map((entry) =>
      t("setlists.lineupPair", {
        role: bandRoleLabel(entry.role, t),
        name: entry.name,
      }),
    )
    .filter((part) => part.trim().length > 0)
    .join(" · ")

/**
 * The roles the picker offers a member: the ones they declared first (that is
 * usually the answer), then the rest of the catalogue in its own order.
 */
export const rolesForMember = (member: OrganizationMember | null): string[] => {
  const declared = sanitizeRoleIds(member?.instruments ?? [])
  const rest = BAND_ROLES.map((role) => role.id).filter((id) => !declared.includes(id))
  return [...declared, ...rest]
}

/**
 * Push notification core (roadmap #52).
 *
 * Pure on purpose — **no firebase-admin imports at all, not even type-only
 * ones** (unlike `purge.ts`, where type-only was enough): the app reads this
 * module through the `@/functions` tsconfig alias for the type and the
 * opt-out defaults, so keeping it import-free is the cheapest possible
 * guarantee that Metro never drags the Admin SDK into the bundle. The message
 * strings also live here instead of `locales/` because the functions workspace
 * never ships the app's locale files — every template is written in English
 * and Spanish side by side and unit-tested for both.
 */

export const PUSH_NOTIFICATION_TYPES = [
  "suggestionCreated",
  "suggestionResolved",
  "commentMentioned",
  "suggestionAssigned",
  "performanceCreated",
  "invitationReceived",
  "membershipChanged",
] as const

export type PushNotificationType = (typeof PUSH_NOTIFICATION_TYPES)[number]

export type PushLanguage = "en" | "es"

export const isPushLanguage = (value: unknown): value is PushLanguage =>
  value === "en" || value === "es"

/**
 * `users/{uid}.preferences.notifications` holds **opt-outs**: an absent map
 * (every account created before #52) or an absent key means "enabled", so the
 * feature ships without a migration and a new type is on for everyone until
 * somebody turns it off.
 */
export const pushTypeEnabled = (
  preferences:
    | { notifications?: Partial<Record<PushNotificationType, boolean>> }
    | null
    | undefined,
  type: PushNotificationType,
): boolean => preferences?.notifications?.[type] !== false

export interface PushContext {
  /** Who caused it: the suggestion's author, the reviewing admin, the inviter. */
  actorName?: string
  bandName?: string
  songTitle?: string
  eventName?: string
  /** `yyyy-mm-dd` as stored on the performance. */
  eventDate?: string
  /** suggestionResolved: how it ended. */
  status?: "accepted" | "rejected"
  /** membershipChanged: which membership event fired. */
  membership?: "role" | "removed"
}

export interface PushMessage {
  title: string
  body: string
}

const ANONYMOUS = {
  en: { member: "A member", admin: "An admin" },
  es: { member: "Un miembro", admin: "Un admin" },
} as const

const TEMPLATES: Record<
  PushLanguage,
  Record<PushNotificationType, (ctx: PushContext) => PushMessage>
> = {
  en: {
    suggestionCreated: (ctx) => ({
      title: ctx.bandName ? `New suggestion in ${ctx.bandName}` : "New suggestion",
      body: `${ctx.actorName ?? ANONYMOUS.en.member} proposed a change${ctx.songTitle ? ` to "${ctx.songTitle}"` : ""}.`,
    }),
    suggestionResolved: (ctx) => ({
      title: ctx.songTitle ? `Your suggestion about "${ctx.songTitle}"` : "Your suggestion",
      body: `${ctx.actorName ?? ANONYMOUS.en.admin} ${ctx.status === "rejected" ? "rejected" : "accepted"} it.`,
    }),
    commentMentioned: (ctx) => ({
      title: "You were mentioned",
      body: ctx.songTitle
        ? `${ctx.actorName ?? ANONYMOUS.en.member} mentioned you in a comment on "${ctx.songTitle}".`
        : `${ctx.actorName ?? ANONYMOUS.en.member} mentioned you in a suggestion's comments.`,
    }),
    suggestionAssigned: (ctx) => ({
      title: "A suggestion was assigned to you",
      body: ctx.songTitle
        ? `${ctx.actorName ?? ANONYMOUS.en.member} assigned you the suggestion about "${ctx.songTitle}".`
        : `${ctx.actorName ?? ANONYMOUS.en.member} assigned you a suggestion.`,
    }),
    performanceCreated: (ctx) => ({
      title: ctx.eventName ? `New event: ${ctx.eventName}` : "New event",
      body: ctx.eventDate
        ? `${ctx.eventDate} — added to the band calendar.`
        : "Added to the band calendar.",
    }),
    invitationReceived: (ctx) => ({
      title: ctx.bandName ? `Join ${ctx.bandName}` : "Band invitation",
      body: `${ctx.actorName ?? ANONYMOUS.en.admin} invited you to join the band.`,
    }),
    membershipChanged: (ctx) =>
      ctx.membership === "removed"
        ? {
            title: ctx.bandName ? `Removed from ${ctx.bandName}` : "Removed from the band",
            body: "You are no longer a member of this band.",
          }
        : {
            title: "Membership changed",
            body: ctx.bandName
              ? `Your role in ${ctx.bandName} changed.`
              : "Your role in the band changed.",
          },
  },
  es: {
    suggestionCreated: (ctx) => ({
      title: ctx.bandName ? `Nueva sugerencia en ${ctx.bandName}` : "Nueva sugerencia",
      body: `${ctx.actorName ?? ANONYMOUS.es.member} propuso un cambio${ctx.songTitle ? ` en "${ctx.songTitle}"` : ""}.`,
    }),
    suggestionResolved: (ctx) => ({
      title: ctx.songTitle ? `Tu sugerencia sobre "${ctx.songTitle}"` : "Tu sugerencia",
      body: `${ctx.actorName ?? ANONYMOUS.es.admin} la ${ctx.status === "rejected" ? "rechazó" : "aceptó"}.`,
    }),
    commentMentioned: (ctx) => ({
      title: "Te mencionaron",
      body: ctx.songTitle
        ? `${ctx.actorName ?? ANONYMOUS.es.member} te mencionó en un comentario sobre "${ctx.songTitle}".`
        : `${ctx.actorName ?? ANONYMOUS.es.member} te mencionó en los comentarios de una sugerencia.`,
    }),
    suggestionAssigned: (ctx) => ({
      title: "Te asignaron una sugerencia",
      body: ctx.songTitle
        ? `${ctx.actorName ?? ANONYMOUS.es.member} te asignó la sugerencia sobre "${ctx.songTitle}".`
        : `${ctx.actorName ?? ANONYMOUS.es.member} te asignó una sugerencia.`,
    }),
    performanceCreated: (ctx) => ({
      title: ctx.eventName ? `Evento nuevo: ${ctx.eventName}` : "Evento nuevo",
      body: ctx.eventDate
        ? `${ctx.eventDate} — añadido al calendario de la banda.`
        : "Añadido al calendario de la banda.",
    }),
    invitationReceived: (ctx) => ({
      title: ctx.bandName ? `Únete a ${ctx.bandName}` : "Invitación a una banda",
      body: `${ctx.actorName ?? ANONYMOUS.es.admin} te invitó a unirte a la banda.`,
    }),
    membershipChanged: (ctx) =>
      ctx.membership === "removed"
        ? {
            title: ctx.bandName
              ? `Ya no formas parte de ${ctx.bandName}`
              : "Ya no formas parte de la banda",
            body: "Dejaste de ser miembro de esta banda.",
          }
        : {
            title: "Cambio de membresía",
            body: ctx.bandName
              ? `Tu rol en ${ctx.bandName} cambió.`
              : "Tu rol en la banda cambió.",
          },
  },
}

/** The localized pair for one event, always non-empty for every type/language. */
export const buildPushMessage = (
  type: PushNotificationType,
  lang: PushLanguage,
  context: PushContext = {},
): PushMessage => TEMPLATES[lang][type](context)

/** The Expo Push Service accepts at most 100 messages per HTTP request. */
export const EXPO_PUSH_BATCH_LIMIT = 100

export const chunkMessages = <T>(
  items: readonly T[],
  size = EXPO_PUSH_BATCH_LIMIT,
): T[][] => {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size) as T[])
  }
  return batches
}

export interface PushTicketFailure {
  token: string
  reason: string
}

export interface ExpoPushTicket {
  status?: string
  details?: { error?: string }
}

/**
 * The push service answers with one ticket per message, in order. Only the
 * errors matter here: `DeviceNotRegistered` is the signal to prune a token
 * whose app was uninstalled; everything else (rate limits, transient errors)
 * leaves the token alone for the next send.
 */
export const parseTicketFailures = (
  tickets: readonly ExpoPushTicket[] | undefined,
  tokens: readonly string[],
): PushTicketFailure[] => {
  const failures: PushTicketFailure[] = []
  tickets?.forEach((ticket, index) => {
    const token = tokens[index]
    if (!token) return
    if (ticket?.status === "error" && typeof ticket.details?.error === "string") {
      failures.push({ token, reason: ticket.details.error })
    }
  })
  return failures
}

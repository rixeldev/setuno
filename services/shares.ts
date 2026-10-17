import { getFunctions, httpsCallable } from "@react-native-firebase/functions"

import {
  doc,
  firestore,
  mapDoc,
  onSnapshot,
  paths,
  updateDoc,
  type Unsubscribe,
} from "@/db/Fire"
import { sanitizeShareLive } from "@/libs/shareView"
import type {
  SharedSetlistPayload,
  SharedSongPayload,
  ShareKind,
  ShareLive,
} from "@/functions/src/shares"

/** Input of the `createShare` callable (functions/src/index.ts). */
export interface CreateShareInput {
  kind: ShareKind
  organizationId: string
  sourceId: string
  /** `null` = never expires; otherwise one of `SHARE_EXPIRY_DAYS` (30 or 7). */
  expiresInDays: number | null
}

export interface ShareLink {
  token: string
  /** Deadline in epoch milliseconds, `null` when the link never expires. */
  expiresAt: number | null
  /** True when the source's already-active link was refreshed in place. */
  reused: boolean
}

/** A share as the public screen receives it: flattened, numbers not stamps. */
export interface FetchedShare {
  version: number
  kind: ShareKind
  organizationId: string
  sourceId: string
  title: string
  payload: SharedSongPayload | SharedSetlistPayload
  expiresAt: number | null
  /**
   * The band's current position while the show runs (roadmap #57), `null`
   * for a static link — sanitized here, so a stray document can never reach
   * the public screen half-valid.
   */
  live: ShareLive | null
}

const epochMillis = (value: unknown): number | null => {
  if (typeof value === "number") return value
  const holder = value as { toMillis?: () => number } | null | undefined
  return holder && typeof holder.toMillis === "function" ? holder.toMillis() : null
}

/**
 * Firestore error codes differ by platform (`firestore/permission-denied`
 * native, `permission-denied` on the JS SDK), so match on the tail.
 */
const isPermissionDenied = (error: unknown): boolean => {
  const code = (error as { code?: unknown }).code
  return typeof code === "string" && code.includes("permission-denied")
}

const mapShare = (data: Record<string, unknown>): FetchedShare | null => {
  const kind = data.kind === "song" || data.kind === "setlist" ? data.kind : null
  const payload = data.payload
  if (!kind || typeof payload !== "object" || payload === null) return null
  return {
    version: typeof data.version === "number" ? data.version : 0,
    kind,
    organizationId: typeof data.organizationId === "string" ? data.organizationId : "",
    sourceId: typeof data.sourceId === "string" ? data.sourceId : "",
    title: typeof data.title === "string" ? data.title : "",
    payload: payload as SharedSongPayload | SharedSetlistPayload,
    expiresAt: epochMillis(data.expiresAt),
    live: sanitizeShareLive(data.live),
  }
}

/**
 * Publish (or refresh) the active link for this source. One callable round
 * trip: the function builds the snapshot from the stored document, so the
 * caller never uploads content — only identity and expiry.
 */
export const createShareLink = async (input: CreateShareInput): Promise<ShareLink> => {
  const call = httpsCallable<CreateShareInput, ShareLink>(getFunctions(), "createShare")
  const response = await call(input)
  return response.data
}

/** Kill the link for good. Idempotent: revoking a missing token succeeds. */
export const revokeShareLink = async (token: string): Promise<boolean> => {
  const call = httpsCallable<{ token: string }, { revoked: boolean }>(
    getFunctions(),
    "revokeShare",
  )
  const response = await call({ token })
  return response.data.revoked
}

/**
 * Keep the "current position" fresh while the show runs (roadmap #57): one
 * field-level update on the share document, which the rules allow only for a
 * member of the owning band and only on the `live` field. `null` clears it —
 * the link itself stays alive as the static #56 snapshot. Callers treat a
 * rejection as fire-and-forget (a revoked link must never break the reader).
 */
export const setShareLive = async (token: string, live: ShareLive | null): Promise<void> => {
  await updateDoc(doc(firestore, paths.share(token)), { live })
}

/**
 * The public screen's read by exact token — a document listener, because a
 * live setlist (roadmap #57) updates while the page is open and a static
 * share simply never changes again. A single-document listener is served by
 * the same `get` rule a fetch evaluates (`list` stays closed, so the
 * collection still cannot be enumerated). A revoked link answers `null` (no
 * document), and the rules answer an *expired* one with `permission-denied`;
 * both collapse to `null` so every caller sees one "gone" state. Real
 * failures (offline, misconfiguration) flow to `onError`.
 */
export const subscribeShare = (
  token: string,
  onChange: (share: FetchedShare | null) => void,
  onError: (error: unknown) => void,
): Unsubscribe =>
  onSnapshot(
    doc(firestore, paths.share(token)),
    (snapshot) => onChange(mapDoc(snapshot, mapShare)),
    (error) => {
      if (isPermissionDenied(error)) onChange(null)
      else onError(error)
    },
  )

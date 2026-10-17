import { getFunctions, httpsCallable } from "@react-native-firebase/functions"

import { doc, firestore, getDoc, mapDoc, paths } from "@/db/Fire"
import type {
  SharedSetlistPayload,
  SharedSongPayload,
  ShareKind,
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
 * Public read by exact token — the only share operation that touches
 * Firestore directly. A revoked link answers `null` (no document), and the
 * rules answer an *expired* one with `permission-denied`; both mean the same
 * thing to every caller, so both collapse to `null`. Real failures (offline,
 * misconfiguration) still throw for the screen to render.
 */
export const fetchShare = async (token: string): Promise<FetchedShare | null> => {
  try {
    return mapDoc(await getDoc(doc(firestore, paths.share(token))), mapShare)
  } catch (error) {
    if (isPermissionDenied(error)) return null
    throw error
  }
}

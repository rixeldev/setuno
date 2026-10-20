import {
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "@react-native-firebase/auth"
import { getFunctions, httpsCallable } from "@react-native-firebase/functions"

import { exportTextFile } from "@/libs/exportFile"
import { getCurrentUser } from "@/services/auth"
import { sendEmailSignInLink } from "@/services/emailAuth"

/**
 * Account-level export and deletion (roadmap #68). Both operations are
 * **callables** — the JSON is assembled and the deletion executed server-side
 * through the Admin SDK (`functions/src/accountData.ts`), so the client never
 * needs read access to anything the export collects and no security rule
 * changes with this feature.
 *
 * The export is delivered inline (the callable answers with the JSON itself)
 * and handed to the OS share sheet on native or the browser download on web
 * through `libs/exportFile`, the same seam the song's ChordPro export uses.
 */

/** What the `exportMyData` callable hands back: one file, ready to save. */
export interface AccountExportFile {
  json: string
  filename: string
}

/**
 * How this account can re-prove who it is before deleting itself: a password
 * (email/password accounts — the SDK's own challenge) or the Google popup /
 * account picker. `null` only for a provider this app cannot re-challenge yet
 * (Apple ships with roadmap #66); such an account proceeds on its session.
 *
 * Note that an **email-link** account (#67) reports the `password` provider
 * too, yet has no password to type — which is why the deletion dialog offers
 * an emailed challenge alongside the password field rather than trusting this
 * answer on its own.
 */
export type ReauthMethod = "password" | "google" | null

export const reauthMethod = (): ReauthMethod => {
  const user = getCurrentUser()
  const providers = user ? user.providerData.map((entry) => entry.providerId) : []
  if (providers.includes("password")) return "password"
  if (providers.includes("google.com")) return "google"
  return null
}

/** Builds the account's whole export in one callable round trip. */
export const requestAccountExport = async (): Promise<AccountExportFile> => {
  const call = httpsCallable<Record<string, never>, AccountExportFile>(
    getFunctions(),
    "exportMyData",
  )
  const response = await call({})
  return response.data
}

/** Hands the export to the share sheet (native) or the browser (web). */
export const saveAccountExport = async (
  file: AccountExportFile,
  dialogTitle: string,
): Promise<boolean> =>
  exportTextFile({
    fileName: file.filename,
    content: file.json,
    mimeType: "application/json",
    dialogTitle,
  })

/** The client-side re-authentication the deletion demands (#68's spec). */
export const reauthenticateWithPassword = async (password: string): Promise<void> => {
  const user = getCurrentUser()
  if (!user || !user.email) throw new Error("You need to be signed in to do that.")
  const credential = EmailAuthProvider.credential(user.email, password)
  await reauthenticateWithCredential(user, credential)
}

/**
 * Roadmap #67's half of "verify re-auth flows": an email link re-proves
 * identity exactly like a password or the Google picker, which is what lets an
 * account **without a password** — a passwordless sign-in reports the
 * `password` provider all the same — still delete itself.
 *
 * One-shot on purpose: `takeEmailLinkReauth()` clears the flag, so a challenge
 * that was met once can never be replayed later in the same session, and no
 * clock is consulted anywhere (a timestamp in render is the thing this design
 * avoids, not the thing it wants).
 */
let emailLinkReauthed = false

/** Records that an emailed link just re-authenticated the signed-in account. */
export const noteEmailLinkReauth = (): void => {
  emailLinkReauthed = true
}

/** Reads — and consumes — the pending email-link challenge. */
export const takeEmailLinkReauth = (): boolean => {
  const value = emailLinkReauthed
  emailLinkReauthed = false
  return value
}

/**
 * Sends the emailed challenge to the signed-in account's own address.
 *
 * Offered next to the password field rather than instead of it: an email-link
 * account (#67) carries the `password` provider without ever having had a
 * password, so it would otherwise reach this dialog and find no way through.
 * A member who simply forgot their password gets the same door.
 */
export const sendEmailLinkReauth = async (): Promise<void> => {
  const user = getCurrentUser()
  if (!user || !user.email) throw new Error("You need to be signed in to do that.")
  await sendEmailSignInLink(user.email)
}

/**
 * Deletes the account for good. `confirmed` is the callable's own backstop
 * that the danger dialog really was completed — the server never trusts a
 * bare session with an account deletion.
 */
export const deleteAccount = async (): Promise<void> => {
  const call = httpsCallable<{ confirmed: boolean }, { deleted: boolean }>(
    getFunctions(),
    "deleteMyAccount",
  )
  await call({ confirmed: true })
}

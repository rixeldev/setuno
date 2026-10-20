import { deleteObject, getDownloadURL, ref, uploadBytes } from "@react-native-firebase/storage"

import { storage } from "@/db/firebaseConfig"
import { doc, firestore, paths, requireUserId, updateDoc } from "@/db/Fire"
import type { SongAttachment } from "@/interfaces"
import type { PickedFile } from "@/interfaces/pickedFile"
import {
  ATTACHMENT_FILE_MAX_BYTES,
  MAX_SONG_ATTACHMENTS,
  attachmentBaseName,
  isPdfFileName,
  linkHost,
  sanitizeSongAttachments,
} from "@/libs/songAttachments"
import { normalizeSongLink } from "@/libs/songLinks"
import { fetchSong } from "@/services/songs"
import { ValidationError } from "@/services/errors"

/**
 * Song attachments (roadmap #40): the write-through half of
 * `libs/songAttachments.ts`. Each operation re-reads the song, applies one
 * change and writes **the `attachments` field and nothing else** — no
 * `updatedAt` (an attached chart is not a lyrics edit, so the stale-save guard
 * and the version history stay out of it) — the `saveShowLog` field-level
 * pattern. Files go to `organizations/{orgId}/songs/{songId}/attachments/{uid}/…`
 * under the *uploader's* uid segment: Storage rules cannot see the band
 * roster, so the folder is bounded by the caller exactly like `avatars/`, and
 * the list itself lives on the song document behind the admin-only update
 * rule (a stray object nobody references shows up nowhere).
 *
 * Removing an entry never deletes the object: `purgeSong` doesn't cascade to
 * Storage either, a duplicated song shares the same object, and Storage has no
 * cascade to begin with — the band sees the entry disappear, the bucket keeps
 * a file worth fractions of a cent. Only a **failed** attach rolls its fresh
 * object back, so a bounced write never leaves unreferenced junk.
 */

const newAttachmentId = (): string =>
  `att_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/** The song's current list, or a friendly "gone" when it was deleted. */
const currentAttachments = async (organizationId: string, songId: string): Promise<SongAttachment[]> => {
  const song = await fetchSong(organizationId, songId)
  if (!song) throw new ValidationError("Song not found.", "songId")
  return song.attachments
}

/** Single choke point: sanitize, pin the cap, write the field alone. */
const writeAttachments = async (
  organizationId: string,
  songId: string,
  // `unknown[]` on purpose: callers hand over fresh literals carrying a client
  // `Date` while the model types the read shape (`TimestampLike`) — Firestore
  // stores either as a real timestamp, and the sanitizer is the validator
  // either way.
  entries: readonly unknown[],
): Promise<void> => {
  const next = sanitizeSongAttachments(entries)
  if (next.length > MAX_SONG_ATTACHMENTS) {
    throw new ValidationError(`A song can hold up to ${MAX_SONG_ATTACHMENTS} attachments.`)
  }
  await updateDoc(doc(firestore, paths.song(organizationId, songId)), { attachments: next })
}

/**
 * Attaches a plain URL (a chart somewhere on the web, a rehearsal recording
 * the band shared from Drive/WhatsApp/…). No Storage involved: the entry
 * lands on the document in one write.
 */
export const addSongAttachmentLink = async (
  organizationId: string,
  songId: string,
  input: { name: string; url: string; note: string },
  author: { name: string },
): Promise<void> => {
  const uid = requireUserId()
  const url = normalizeSongLink(input.url)
  if (url.length === 0) throw new ValidationError("That link isn't a web address.", "url")

  const current = await currentAttachments(organizationId, songId)
  if (current.length >= MAX_SONG_ATTACHMENTS) {
    throw new ValidationError(`A song can hold up to ${MAX_SONG_ATTACHMENTS} attachments.`)
  }

  await writeAttachments(organizationId, songId, [
    ...current,
    {
      id: newAttachmentId(),
      kind: "link",
      name: input.name.trim() || linkHost(url),
      url,
      path: "",
      size: 0,
      note: input.note,
      uploadedBy: uid,
      uploadedByName: author.name,
      uploadedAt: new Date(),
    },
  ])
}

/**
 * Uploads a PDF to Storage and appends its entry. The size is verified
 * before *and* after the read (the picked file's metadata can lie), the cap
 * is checked before any bytes move, and a failure after the upload attempts
 * to remove the fresh object before rethrowing.
 */
export const addSongAttachmentFile = async (
  organizationId: string,
  songId: string,
  file: PickedFile,
  input: { name: string; note: string },
  author: { name: string },
): Promise<void> => {
  const uid = requireUserId()
  if (!isPdfFileName(file.name)) throw new ValidationError("Only PDF files can be attached.")
  if (file.size > ATTACHMENT_FILE_MAX_BYTES) throw new ValidationError("That file is over 10 MB.")

  const current = await currentAttachments(organizationId, songId)
  if (current.length >= MAX_SONG_ATTACHMENTS) {
    throw new ValidationError(`A song can hold up to ${MAX_SONG_ATTACHMENTS} attachments.`)
  }

  const id = newAttachmentId()
  const path = `organizations/${organizationId}/songs/${songId}/attachments/${uid}/${id}.pdf`
  const bytes = await file.bytes()
  if (bytes.byteLength > ATTACHMENT_FILE_MAX_BYTES) throw new ValidationError("That file is over 10 MB.")

  const objectRef = ref(storage, path)
  await uploadBytes(objectRef, bytes, { contentType: "application/pdf" })

  try {
    const url = await getDownloadURL(objectRef)
    await writeAttachments(organizationId, songId, [
      ...current,
      {
        id,
        kind: "file",
        name: input.name.trim() || attachmentBaseName(file.name),
        url,
        path,
        size: bytes.byteLength,
        note: input.note,
        uploadedBy: uid,
        uploadedByName: author.name,
        uploadedAt: new Date(),
      },
    ])
  } catch (error) {
    // The object exists but nothing points at it: roll it back best-effort
    // (the rules only let the uploader clean their own folder) and surface
    // the original failure.
    void deleteObject(objectRef).catch(() => undefined)
    throw error
  }
}

/**
 * Detaches an entry by id — idempotent, so an offline replay of a removal
 * that already landed simply settles. The Storage object stays (see the
 * module docstring); `updatedAt` is untouched, as everywhere here.
 */
export const removeSongAttachment = async (
  organizationId: string,
  songId: string,
  attachmentId: string,
): Promise<void> => {
  requireUserId()
  const current = await currentAttachments(organizationId, songId)
  const next = current.filter((entry) => entry.id !== attachmentId)
  if (next.length === current.length) return
  await writeAttachments(organizationId, songId, next)
}

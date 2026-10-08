import { doc, firestore, getDoc, paths, serverTimestamp, setDoc } from "@/db/Fire"
import { DEMO_SONG_ID, DEMO_SONG_TITLE, demoSongSections } from "@/libs/demoSong"
import { logActivity } from "@/services/activity"
import { updatePreferences } from "@/services/users"

export interface DemoSeedOptions {
  organizationId: string
  uid: string
  authorName: string
  /** True when the profile already published the sample for this account. */
  alreadySeeded: boolean
}

/**
 * Publishes the sample song exactly once per account.
 *
 * Two guards make "once" real: the flag stored on the profile preferences
 * (survives re-installs, other devices and a deletion of the song) and the
 * deterministic document id (survives a race between two devices). The flag is
 * never derived from the song existing, so deleting the sample cannot bring it
 * back.
 *
 * @returns true when the song was created by this call.
 */
export const seedDemoSongOnce = async (options: DemoSeedOptions): Promise<boolean> => {
  if (options.alreadySeeded) return false

  const reference = doc(firestore, paths.song(options.organizationId, DEMO_SONG_ID))
  const snapshot = await getDoc(reference)
  let created = false

  if (!snapshot.exists()) {
    const now = serverTimestamp()
    await setDoc(reference, {
      organizationId: options.organizationId,
      title: DEMO_SONG_TITLE,
      artist: "Setuno",
      key: "Em",
      originalKey: "Em",
      capo: 0,
      bpm: 92,
      durationSec: 134,
      genre: "Demo",
      notes:
        "Canción de ejemplo creada una sola vez para que veas el lector. Prueba a transponerla, cambiar el capo o editar los acordes de la intro. Puedes borrarla: no volverá a aparecer.",
      tags: ["demo", "ejemplo"],
      sections: demoSongSections(),
      createdBy: options.uid,
      createdByName: options.authorName,
      createdAt: now,
      updatedAt: now,
    })
    created = true

    void logActivity({
      organizationId: options.organizationId,
      type: "song_created",
      message: `${options.authorName} added "${DEMO_SONG_TITLE}"`,
      actorId: options.uid,
      actorName: options.authorName,
      targetType: "song",
      targetId: DEMO_SONG_ID,
    })
  }

  // Remember it on the profile even when the song already existed (another
  // device seeded it first), so the check never runs again.
  await updatePreferences(options.uid, { demoSongSeeded: true })

  return created
}

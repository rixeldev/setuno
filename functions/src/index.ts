import { initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { logger } from "firebase-functions/v2"
import { onSchedule } from "firebase-functions/v2/scheduler"

import { TRASH_TTL_DAYS, purgeExpiredSongs } from "./purge"

initializeApp()

/**
 * The Cloud Functions workspace (roadmap P0.1) opens with the scheduled half
 * of the song trash (#31): every day, songs that spent their 30 days in the
 * trash are deleted for good. Until this function is deployed the trash holds
 * forever and purging is manual; once it runs, the trash screen's promise —
 * "you have 30 days to restore" — is kept by the schedule. The odd minute
 * keeps the run off the top-of-hour stampede, where the whole internet fires
 * at once.
 */
export const purgeTrashedSongs = onSchedule(
  {
    schedule: "every day 04:17",
    timeZone: "UTC",
    memory: "256MiB",
    timeoutSeconds: 540,
  },
  async () => {
    const result = await purgeExpiredSongs(getFirestore(), new Date())
    logger.info("purgeTrashedSongs finished", {
      ttlDays: TRASH_TTL_DAYS,
      songs: result.songs,
      versions: result.versions,
    })
  },
)

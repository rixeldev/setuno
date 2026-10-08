import { appVersionId } from "@/db/firebaseConfig"
import { collection, firestore, getDocsFromServer } from "@/db/Fire"

/** Release marker collection: one document per supported app version. */
const VERSION_COLLECTION = "version"

/**
 * Whether this build's version record still exists in the `version`
 * collection.
 *
 * A release replaces the record (create the new document, delete the old one),
 * so a missing record means the installed build is outdated. Returns `null`
 * when the answer cannot be determined (offline, permissions…) — the caller
 * must never force an update on a guess.
 */
export const isRunningLatestVersion = async (): Promise<boolean | null> => {
  try {
    const snapshot = await getDocsFromServer(collection(firestore, VERSION_COLLECTION))
    return snapshot.docs.some((item) => item.id === appVersionId)
  } catch {
    return null
  }
}

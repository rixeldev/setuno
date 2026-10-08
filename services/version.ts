import Constants from "expo-constants"

import { collection, firestore, getDocsFromServer } from "@/db/Fire"
import { compareVersions, maxVersion } from "@/libs/version"

/**
 * Release marker collection. Its `version` field is bumped by hand every time
 * a new build is published; the highest value wins if older markers are kept
 * around.
 */
const VERSION_COLLECTION = "version"

/**
 * Whether the store now serves a newer build than the one installed.
 *
 * The newest `version` value in Firestore is compared with the installed build
 * (`expo-constants`): a strictly higher value forces the update dialog, equal
 * or lower does nothing. Returns `null` when the answer cannot be determined
 * (offline, permissions, malformed data) — the caller must never force an
 * update on a guess.
 */
export const hasNewerVersionAvailable = async (): Promise<boolean | null> => {
  try {
    const snapshot = await getDocsFromServer(collection(firestore, VERSION_COLLECTION))
    const remote = maxVersion(
      snapshot.docs.map((item) => String(item.get("version") ?? "")),
    )
    const installed = Constants.expoConfig?.version ?? ""
    if (!remote || !installed) return null
    return compareVersions(remote, installed) > 0
  } catch {
    return null
  }
}

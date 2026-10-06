import { doc, firestore, getDoc, paths, serverTimestamp, setDoc, writeBatch } from "@/db/Fire"
import { normalizeUsername, usernameKey, usernameWithSuffix } from "@/libs/username"
import { ValidationError } from "@/services/errors"

/** Suffixed candidates attempted before giving up on a base name. */
const CLAIM_ATTEMPTS = 6

/** Case-insensitive availability check against the public claims registry. */
export const isUsernameTaken = async (username: string): Promise<boolean> => {
  const key = usernameKey(username)
  if (key.length === 0) return false
  const snapshot = await getDoc(doc(firestore, paths.username(key)))
  return snapshot.exists()
}

/**
 * Reserves a unique username for `uid` and returns it.
 *
 * Every attempt is an atomic `create` of `usernames/{lowercased name}`: when the
 * plain name belongs to somebody else the write is denied by the rules, so two
 * accounts can never end up with the same name (`Rixel` === `rixel`). New
 * Google sign-ins land here with the account name and fall back to `Name-1234`.
 */
export const claimUsername = async (uid: string, base: string): Promise<string> => {
  const plain = normalizeUsername(base) || "Musician"
  for (let attempt = 0; attempt <= CLAIM_ATTEMPTS; attempt += 1) {
    const candidate = attempt === 0 ? plain : usernameWithSuffix(plain)
    try {
      await setDoc(doc(firestore, paths.username(usernameKey(candidate))), { uid })
      return candidate
    } catch {
      // Taken by another account (or the write was rejected): try a suffix.
    }
  }
  throw new ValidationError("We couldn't reserve that name. Try a different one.", "displayName")
}

/**
 * Renames a user in one batch: claims the new name, releases the old one and
 * stamps the three-month window on the profile. The security rules require the
 * fresh claim, so a re-name can never squat on somebody else's name.
 */
export const changeUsername = async (
  uid: string,
  previous: string,
  next: string,
): Promise<void> => {
  const normalized = normalizeUsername(next)
  const batch = writeBatch(firestore)
  batch.set(doc(firestore, paths.username(usernameKey(normalized))), { uid })
  const previousKey = usernameKey(previous)
  if (previousKey.length > 0 && previousKey !== usernameKey(normalized)) {
    batch.delete(doc(firestore, paths.username(previousKey)))
  }
  batch.update(doc(firestore, paths.user(uid)), {
    displayName: normalized,
    usernameChangedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}

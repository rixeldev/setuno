import { deleteObject, getDownloadURL, ref, uploadString } from "@react-native-firebase/storage"

import { storage } from "@/db/firebaseConfig"
import { requireUserId } from "@/db/Fire"
import { ValidationError, toFriendlyError } from "@/services/errors"

export interface UploadedFile {
  url: string
  path: string
}

export interface UploadImageInput {
  /** Base64 payload produced by expo-image-picker (`base64: true`). */
  base64: string | null
  mimeType?: string | null
}

/**
 * Uploads an image to Firebase Storage and returns its public download URL.
 * The base64 payload is uploaded directly, which behaves identically on
 * Android and Web (no device filesystem differences).
 */
export const uploadImage = async (
  folder: "avatars" | "organizations",
  input: UploadImageInput,
): Promise<UploadedFile> => {
  const uid = requireUserId()
  if (!input.base64) throw new ValidationError("We couldn't read that image. Try another one.")

  const extension = guessExtension(input.mimeType)
  const path = `${folder}/${uid}/${Date.now()}.${extension}`

  try {
    const reference = ref(storage, path)
    await uploadString(reference, input.base64, "base64", {
      contentType: input.mimeType ?? "image/jpeg",
    })
    const url = await getDownloadURL(reference)
    return { url, path }
  } catch (error) {
    throw new Error(toFriendlyError(error, "The image upload failed. Please try again."))
  }
}

export const deleteImage = async (urlOrPath: string): Promise<void> => {
  try {
    await deleteObject(ref(storage, urlOrPath))
  } catch {
    // Deleting an uploaded image is best-effort; the profile update proceeds.
  }
}

const guessExtension = (mimeType: string | null | undefined): string => {
  switch (mimeType) {
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
    case "image/heic":
    case "image/heif":
      return "heic"
    default:
      return "jpg"
  }
}
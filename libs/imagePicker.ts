import * as ImagePicker from "expo-image-picker"

import { ValidationError } from "@/services/errors"
import type { UploadImageInput } from "@/services/uploads"

/**
 * Cross-platform image picking.
 *
 * The picker always returns a base64 payload so the upload path is identical on
 * Android and on Web (no device filesystem differences). Returns `null` when the
 * user cancels.
 */
export const pickImageBase64 = async (options?: {
  allowsEditing?: boolean
  aspect?: [number, number]
  quality?: number
}): Promise<UploadImageInput | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw new ValidationError("We need permission to open your photos. You can enable it in your settings.")
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: options?.allowsEditing ?? true,
    aspect: options?.aspect ?? [1, 1],
    quality: options?.quality ?? 0.8,
    base64: true,
  })

  if (result.canceled) return null

  const asset = result.assets?.[0]
  if (!asset || !asset.base64) {
    throw new ValidationError("We couldn't read that image. Try another one.")
  }

  return { base64: asset.base64, mimeType: asset.mimeType ?? "image/jpeg" }
}

/** Same as {@link pickImageBase64} but opens the camera first. */
export const captureImageBase64 = async (): Promise<UploadImageInput | null> => {
  const permission = await ImagePicker.requestCameraPermissionsAsync()
  if (!permission.granted) {
    throw new ValidationError("We need camera permission to take a photo.")
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    base64: true,
  })

  if (result.canceled) return null

  const asset = result.assets?.[0]
  if (!asset || !asset.base64) {
    throw new ValidationError("We couldn't read that photo. Try another one.")
  }

  return { base64: asset.base64, mimeType: asset.mimeType ?? "image/jpeg" }
}
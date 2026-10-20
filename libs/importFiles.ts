import { File } from "expo-file-system"

import type { PickedFile } from "@/interfaces/pickedFile"

/**
 * System file picker (roadmap #38's bulk importer, #40's PDF attachments).
 * Native uses the picker `expo-file-system` itself ships — no extra module —
 * and deliberately sets **no** MIME filter: `.cho` files carry no reliable
 * MIME type on Android's SAF and would vanish from the list, so the caller
 * filters by extension once it has the bytes (the same approach keeps a PDF
 * visible even when its provider reports a quirky type).
 */
export const pickImportFiles = async (): Promise<PickedFile[]> => {
  const picked = await File.pickFileAsync({ multipleFiles: true })
  if (picked.canceled || !picked.result) return []
  return picked.result.map((file) => ({
    name: file.name,
    size: file.size,
    text: () => file.text(),
    bytes: () => file.bytes(),
  }))
}

/**
 * Single-file picker for a song attachment (roadmap #40). The single-file
 * overload answers with one `File` (not an array) — verified against the
 * SDK 57 docs — and cancellation settles with `null`, which the caller treats
 * as "the user changed their mind".
 */
export const pickAttachmentPdf = async (): Promise<PickedFile | null> => {
  const picked = await File.pickFileAsync()
  if (picked.canceled || !picked.result) return null
  const file = picked.result
  return {
    name: file.name,
    size: file.size,
    text: () => file.text(),
    bytes: () => file.bytes(),
  }
}

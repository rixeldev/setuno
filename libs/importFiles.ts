import { File } from "expo-file-system"

import type { PickedFile } from "@/interfaces/pickedFile"

/**
 * System file picker for the bulk importer (roadmap #38). Native uses the
 * picker `expo-file-system` itself ships — no extra module — and deliberately
 * sets **no** MIME filter: `.cho` files carry no reliable MIME type on
 * Android's SAF and would vanish from the list, so the importer filters by
 * extension once it has the bytes.
 */
export const pickImportFiles = async (): Promise<PickedFile[]> => {
  const picked = await File.pickFileAsync({ multipleFiles: true })
  if (picked.canceled || !picked.result) return []
  return picked.result.map((file) => ({
    name: file.name,
    text: () => file.text(),
    bytes: () => file.bytes(),
  }))
}

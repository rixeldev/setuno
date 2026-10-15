import type { RefObject } from "react"
import * as Sharing from "expo-sharing"
import { captureRef } from "react-native-view-shot"
import type { ViewShotRef } from "react-native-view-shot"

/** How a captured image is handed to the caller (file name + sheet title). */
export interface ShareImageOptions {
  /** Used by the share sheet / Android's output file name. */
  fileName: string
  /** Android / web share dialog title. */
  dialogTitle?: string
}

/**
 * Captures a view as a PNG and opens the system share sheet (roadmap #35's
 * year-in-review card). Native build of the seam: `react-native-view-shot`
 * writes a tmpfile (named through `fileName` on Android) and `expo-sharing`
 * hands it to the OS. Web never bundles this file — Metro resolves
 * `shareImage.web.ts` there.
 *
 * Resolves `false` when the device cannot share files, so the caller can tell
 * the user instead of failing silently — the same contract `exportTextFile`
 * offers.
 */
export const captureAndShareImage = async (
  view: RefObject<ViewShotRef | null>,
  options: ShareImageOptions,
): Promise<boolean> => {
  if (!(await Sharing.isAvailableAsync())) return false
  const uri = await captureRef(view, {
    format: "png",
    quality: 1,
    result: "tmpfile",
    fileName: options.fileName,
  })
  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    dialogTitle: options.dialogTitle,
    UTI: "public.png",
  })
  return true
}

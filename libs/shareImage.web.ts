import type { RefObject } from "react"
import { captureRef } from "react-native-view-shot"
import type { ViewShotRef } from "react-native-view-shot"

/** How a captured image is handed to the caller (file name + dialog title). */
export interface ShareImageOptions {
  /** The downloaded file's name on the web. */
  fileName: string
  /** Android / web share dialog title (unused on the web). */
  dialogTitle?: string
}

/**
 * Web build of `captureAndShareImage` (roadmap #35): `react-native-view-shot`
 * rasterises the DOM node behind the card with html2canvas — which it ships
 * itself — and returns a **data URI**, because a browser has no tmpfile to
 * write. The PNG is then handed to the browser as a download, exactly like
 * `exportTextFile`: the Web Share API needs HTTPS plus a user gesture, so a
 * Blob download is the reliable path.
 *
 * Resolves `false` when there is no document to download into.
 */
export const captureAndShareImage = async (
  view: RefObject<ViewShotRef | null>,
  options: ShareImageOptions,
): Promise<boolean> => {
  if (typeof document === "undefined") return false
  const dataUrl = await captureRef(view, {
    format: "png",
    quality: 1,
    result: "data-uri",
  })
  const blob = await (await fetch(dataUrl)).blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = options.fileName
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser time to start the download before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

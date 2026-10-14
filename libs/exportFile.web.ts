/** A generated text file handed to the browser as a download. */
export interface ExportTextFileOptions {
  fileName: string
  content: string
  mimeType: string
  /** Android / web share dialog title (unused on the web). */
  dialogTitle?: string
  /** iOS uniform type identifier (unused on the web). */
  uti?: string
}

/**
 * Web build of `exportTextFile` (roadmap #50): triggers a browser download.
 *
 * `expo-sharing` cannot share local files on the web and the Web Share API
 * needs HTTPS plus a user gesture, so a Blob download is the reliable path.
 * Resolves `false` when there is no document to download into.
 */
export const exportTextFile = async (options: ExportTextFileOptions): Promise<boolean> => {
  if (typeof document === "undefined") return false
  const blob = new Blob([options.content], { type: options.mimeType })
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

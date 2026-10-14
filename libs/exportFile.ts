import { File, Paths } from "expo-file-system"
import * as Sharing from "expo-sharing"

/** A generated text file handed to the OS share sheet. */
export interface ExportTextFileOptions {
  fileName: string
  content: string
  mimeType: string
  /** Android / web share dialog title. */
  dialogTitle?: string
  /** iOS uniform type identifier, e.g. `com.apple.ical.ics`. */
  uti?: string
}

/**
 * Writes a text file to the cache and opens the system share sheet (roadmap
 * #50). Web never bundles this file: Metro resolves `exportFile.web.ts` there.
 *
 * Resolves `false` when the device cannot share files, so the caller can tell
 * the user instead of failing silently.
 */
export const exportTextFile = async (options: ExportTextFileOptions): Promise<boolean> => {
  if (!(await Sharing.isAvailableAsync())) return false
  const file = new File(Paths.cache, options.fileName)
  if (file.exists) file.delete()
  file.create()
  file.write(options.content)
  await Sharing.shareAsync(file.uri, {
    mimeType: options.mimeType,
    dialogTitle: options.dialogTitle,
    UTI: options.uti,
  })
  return true
}

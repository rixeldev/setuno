import * as Print from "expo-print"
import * as Sharing from "expo-sharing"

/** Android / iOS share dialog title. */
export interface PrintSheetOptions {
  dialogTitle?: string
}

/**
 * Renders the sheet to a PDF in the cache and opens the system share sheet
 * (roadmap #20). Web never bundles this file: Metro resolves
 * `printFile.web.ts` there.
 *
 * Resolves `false` when the device cannot share files, so the caller can say so
 * instead of failing silently — the same contract as `exportTextFile`.
 */
export const sharePrintSheet = async (
  html: string,
  options: PrintSheetOptions = {},
): Promise<boolean> => {
  if (!(await Sharing.isAvailableAsync())) return false
  const { uri } = await Print.printToFileAsync({ html })
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: options.dialogTitle,
    UTI: "com.adobe.pdf",
  })
  return true
}

/** Sends the sheet straight to the system print dialog instead of sharing it. */
export const printSheet = async (html: string): Promise<boolean> => {
  await Print.printAsync({ html })
  return true
}

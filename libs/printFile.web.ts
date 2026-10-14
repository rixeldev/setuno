/** Share dialog title (unused on the web). */
export interface PrintSheetOptions {
  dialogTitle?: string
}

/**
 * Renders the sheet into a hidden iframe and prints *that*, not the app (roadmap
 * #20). `expo-print` cannot do this on the web — its methods print the current
 * page, and it only generates PDFs in a native runtime — so the browser's own
 * dialog takes over, "Save as PDF" included, with our print stylesheet intact.
 */
const renderInFrame = async (html: string): Promise<boolean> => {
  if (typeof document === "undefined") return false
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.setAttribute("title", "print")
  frame.style.position = "fixed"
  frame.style.right = "0"
  frame.style.bottom = "0"
  frame.style.width = "0"
  frame.style.height = "0"
  frame.style.border = "0"
  document.body.appendChild(frame)

  const frameDocument = frame.contentWindow?.document
  if (!frameDocument) {
    frame.remove()
    return false
  }
  frameDocument.open()
  frameDocument.write(html)
  frameDocument.close()
  frame.contentWindow?.focus()
  frame.contentWindow?.print()
  return true
}

/**
 * Web build of `sharePrintSheet`: there is no PDF to hand to the share sheet,
 * so sharing *is* printing — the browser's dialog offers "Save as PDF" right
 * there, which is the same outcome for anyone who wanted a file.
 */
export const sharePrintSheet = async (
  html: string,
  _options: PrintSheetOptions = {},
): Promise<boolean> => renderInFrame(html)

/** Web build of `printSheet`. */
export const printSheet = async (html: string): Promise<boolean> => renderInFrame(html)

import { requireOptionalNativeModule } from "expo-modules-core"

/**
 * On-device text recognition (roadmap #84).
 *
 * The app never sends a photo to a server: the recognition happens on the
 * phone. Android uses **ML Kit** (the bundled model — no download, no
 * network) and iOS uses the system's **Vision** framework. A PDF is rasterized
 * by the platform itself (`PdfRenderer` on Android, `PDFKit` on iOS) and then
 * read page by page.
 *
 * The module is a **local Expo module**: it lives in `modules/setuno-ocr` and
 * is autolinked through `expo.autolinking.nativeModulesDir`.
 *
 * The web build has no native module, so `isOcrAvailable` is `false` there and
 * the app says so instead of pretending the photo was read.
 */

/** A rectangle in the page's own pixels, with the origin at the top left. */
export interface OcrBox {
  x: number
  y: number
  width: number
  height: number
}

/** One recognized word (or chord) and where it sits. */
export interface OcrWord {
  text: string
  box: OcrBox
}

/** One recognized line of text. */
export interface OcrLine {
  text: string
  /** `null` where the platform gives no confidence (ML Kit does not). */
  confidence: number | null
  box: OcrBox
  words: OcrWord[]
}

/** One page (a photo, or one page of a PDF). */
export interface OcrPage {
  width: number
  height: number
  lines: OcrLine[]
}

/** Everything the recognition found, page by page. */
export interface OcrResult {
  pages: OcrPage[]
}

interface SetunoOcrNativeModule {
  recognizeImage(uri: string): Promise<OcrResult>
  recognizePdf(uri: string): Promise<OcrResult>
}

/**
 * The native module, or `null` where there is none — the web build has no
 * on-device recognizer.
 */
const native = requireOptionalNativeModule<SetunoOcrNativeModule>("SetunoOcr")

/** True where a photo or a PDF can actually be read. */
export const isOcrAvailable = native !== null

/** The error the app shows when the recognition is not possible. */
export class OcrUnavailableError extends Error {
  constructor() {
    super("On-device text recognition is not available on this platform.")
    this.name = "OcrUnavailableError"
  }
}

/** Reads the text of a photo (a chord sheet, a page, a screenshot). */
export const recognizeImage = async (uri: string): Promise<OcrResult> => {
  if (!native) throw new OcrUnavailableError()
  return native.recognizeImage(uri)
}

/** Reads the text of a PDF, page by page. */
export const recognizePdf = async (uri: string): Promise<OcrResult> => {
  if (!native) throw new OcrUnavailableError()
  return native.recognizePdf(uri)
}

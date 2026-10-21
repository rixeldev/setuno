/**
 * The shapes the on-device recognizer (roadmap #84) hands over.
 *
 * They live in `interfaces/` because they cross the boundary between the
 * native module and the app: the module fills them, the pure core reads them.
 * Every box is in the page's own pixels, with the origin at the top left.
 */

/** A rectangle in the page's pixels. */
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
  confidence?: number | null
  box: OcrBox
  words: OcrWord[]
}

/** One page: a photo, or one page of a PDF. */
export interface OcrPage {
  width: number
  height: number
  lines: OcrLine[]
}

/** Everything the recognition found, page by page. */
export interface OcrResult {
  pages: OcrPage[]
}

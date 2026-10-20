/** A picked import/attachment file: name, size plus lazy readers (roadmap #38, #40). */
export interface PickedFile {
  name: string
  /** Size in bytes as reported by the picker (metadata — no read needed). */
  size: number
  text: () => Promise<string>
  bytes: () => Promise<Uint8Array>
}

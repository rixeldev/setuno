/** A picked import file: its name plus lazy readers (roadmap #38). */
export interface PickedFile {
  name: string
  text: () => Promise<string>
  bytes: () => Promise<Uint8Array>
}

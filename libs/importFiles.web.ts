import type { PickedFile } from "@/interfaces/pickedFile"

/**
 * Browser half of the file pickers (roadmap #38's bulk importer, #40's PDF
 * attachments): a plain `<input type="file">`, which needs no dependency and
 * accepts everything the native picker does. Cancelling settles with an empty
 * list on browsers that fire `cancel`; on older ones the promise simply never
 * resolves, which is invisible because picking carries no loading state.
 */
export const pickImportFiles = (): Promise<PickedFile[]> => pickFiles(".json,.csv,.cho,.zip", true)

/**
 * Single-file picker for a song attachment (roadmap #40): the browser's own
 * PDF filter pre-selects sensible files, and the caller still verifies the
 * extension before reading any bytes.
 */
export const pickAttachmentPdf = (): Promise<PickedFile | null> =>
  pickFiles(".pdf,application/pdf", false).then((files) => files[0] ?? null)

const pickFiles = (accept: string, multiple: boolean): Promise<PickedFile[]> =>
  new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = accept
    input.multiple = multiple

    let settled = false
    const finish = (files: PickedFile[]): void => {
      if (settled) return
      settled = true
      input.remove()
      resolve(files)
    }

    input.onchange = () => {
      // The DOM File objects keep their own blob reference, so removing the
      // input afterwards never invalidates the readers handed to the caller.
      finish(
        Array.from(input.files ?? []).map((file) => ({
          name: file.name,
          size: file.size,
          text: () => file.text(),
          bytes: async () => new Uint8Array(await file.arrayBuffer()),
        })),
      )
    }
    const withCancel = input as HTMLInputElement & { oncancel: (() => void) | null }
    withCancel.oncancel = () => finish([])

    input.click()
  })

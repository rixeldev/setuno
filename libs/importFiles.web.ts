import type { PickedFile } from "@/interfaces/pickedFile"

/**
 * Browser half of the bulk importer's file picker (roadmap #38): a plain
 * `<input type="file">`, which needs no dependency and accepts everything the
 * native picker does. Cancelling settles with an empty list on browsers that
 * fire `cancel`; on older ones the promise simply never resolves, which is
 * invisible because picking carries no loading state.
 */
export const pickImportFiles = (): Promise<PickedFile[]> =>
  new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json,.csv,.cho,.zip"
    input.multiple = true

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
          text: () => file.text(),
          bytes: async () => new Uint8Array(await file.arrayBuffer()),
        })),
      )
    }
    const withCancel = input as HTMLInputElement & { oncancel: (() => void) | null }
    withCancel.oncancel = () => finish([])

    input.click()
  })

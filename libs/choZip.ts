import JSZip from "jszip"

/**
 * Reads a `.zip` full of `.cho` files (roadmap #38). Pure JavaScript — the
 * SDK ships no zip module, so `jszip` (inflate included) is the one
 * dependency this feature adds; it runs identically on both platforms.
 */

/** A zip larger than this is refused whole, like the import caps it feeds. */
export const MAX_ZIP_ENTRIES = 300

export interface ChoZipEntry {
  /** Path inside the archive, e.g. `songs/Hotel California.cho`. */
  name: string
  /** The ChordPro document's text. */
  source: string
}

/**
 * Every `.cho` entry of the archive, in file order. macOS resource forks
 * (`__MACOSX/…`) and directories are skipped; so is anything that is not a
 * `.cho`, so a zip of photos simply imports nothing.
 */
export const extractChoFiles = async (bytes: Uint8Array): Promise<ChoZipEntry[]> => {
  const archive = await JSZip.loadAsync(bytes)
  const entries = Object.values(archive.files)
    .filter(
      (entry) =>
        !entry.dir && !entry.name.startsWith("__MACOSX/") && /\.cho$/i.test(entry.name),
    )
    .slice(0, MAX_ZIP_ENTRIES)

  const files: ChoZipEntry[] = []
  for (const entry of entries) {
    files.push({ name: entry.name, source: await entry.async("text") })
  }
  return files
}

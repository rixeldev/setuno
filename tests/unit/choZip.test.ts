import JSZip from "jszip"
import { describe, expect, it } from "vitest"

import { extractChoFiles, MAX_ZIP_ENTRIES } from "@/libs/choZip"

const buildZip = async (entries: Record<string, string>): Promise<Uint8Array> => {
  const zip = new JSZip()
  for (const [name, source] of Object.entries(entries)) zip.file(name, source)
  return zip.generateAsync({ type: "uint8array" })
}

describe("extractChoFiles", () => {
  it("returns only the .cho entries, skipping junk and other files", async () => {
    const bytes = await buildZip({
      "Hotel California.cho": "{title: Hotel California}",
      "__MACOSX/._Hotel California.cho": "resource fork junk",
      "songs/Creep.cho": "{title: Creep}",
      "readme.txt": "not a song",
    })

    const files = await extractChoFiles(bytes)
    const names = files.map((entry) => entry.name).sort()
    expect(names).toEqual(["Hotel California.cho", "songs/Creep.cho"])
    expect(files.find((entry) => entry.name === "songs/Creep.cho")!.source).toBe("{title: Creep}")
  })

  it("yields nothing for a zip without ChordPro files", async () => {
    const bytes = await buildZip({ "photo.jpg": "not really a photo" })
    expect(await extractChoFiles(bytes)).toEqual([])
  })

  it("caps how many songs one archive can bring in", async () => {
    const entries: Record<string, string> = {}
    for (let index = 0; index <= MAX_ZIP_ENTRIES; index++) {
      entries[`song-${index}.cho`] = `{title: Song ${index}}`
    }
    const files = await extractChoFiles(await buildZip(entries))
    expect(files).toHaveLength(MAX_ZIP_ENTRIES)
  })
})

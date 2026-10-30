import { requireUserId } from "@/db/Fire"
import type { OrganizationMember, Performance, Setlist, Song, TimestampLike } from "@/interfaces"
import {
  buildBandBackup,
  remapPerformanceForImport,
  remapSetlistForImport,
  serializeBandBackup,
  type BandBackupSong,
  type ImportPlan,
} from "@/libs/bandBackup"
import { exportTextFile } from "@/libs/exportFile"
import { logActivity } from "@/services/activity"
import { createPerformance, saveShowLog, saveShowNotes } from "@/services/performances"
import { createSetlist, setSetlistTemplate } from "@/services/setlists"
import { createSong } from "@/services/songs"

/**
 * Band backup delivery and execution (roadmap #38). The parsing and planning
 * are pure in `libs/bandBackup.ts`; this module only touches the network:
 * serializing into the share-sheet/browser-download seam (#18 and #68 ride
 * the same one) and replaying a plan's creates in dependency order.
 */

/** Placeholder stamps for the in-memory library entries a run builds. */
const EPOCH: TimestampLike = { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) }

export const downloadBandBackup = async (input: {
  organizationName: string
  members: readonly OrganizationMember[]
  songs: readonly Song[]
  setlists: readonly Setlist[]
  performances: readonly Performance[]
}): Promise<boolean> => {
  const backup = buildBandBackup({ ...input, exportedAt: new Date().toISOString() })
  const slug =
    input.organizationName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "band"
  const day = new Date().toISOString().slice(0, 10)

  return exportTextFile({
    fileName: `setuno-backup-${slug}-${day}.json`,
    content: serializeBandBackup(backup),
    mimeType: "application/json",
    dialogTitle: "Setuno backup",
  })
}

export interface ImportResult {
  songs: number
  setlists: number
  performances: number
}

/**
 * A newly created song, complete enough for the in-memory library the
 * setlist writer reads titles and durations from. Stamps are placeholders:
 * nothing here is ever written to Firestore.
 */
const importedSong = (
  draft: BandBackupSong,
  id: string,
  organizationId: string,
  author: { id: string; name: string },
): Song => ({
  id,
  organizationId,
  title: draft.title,
  artist: draft.artist,
  key: draft.key,
  originalKey: draft.originalKey,
  capo: draft.capo,
  bpm: draft.bpm,
  durationSec: draft.durationSec,
  genre: draft.genre,
  notes: draft.notes,
  tags: draft.tags,
  sections: draft.sections,
  links: draft.links,
  // The backup deliberately carries no attachments (like attendance/liveShare):
  // the PDFs live in Storage behind this band, so a restored song starts clean.
  attachments: [],
  status: draft.status,
  deletedAt: null,
  deletedBy: null,
  createdBy: author.id,
  createdByName: author.name,
  createdAt: EPOCH,
  updatedAt: EPOCH,
})

/**
 * Replays a plan in dependency order — songs first (each new id feeds the
 * setlist map), then setlists (feeding the event map), then events with their
 * show logs. Sequential on purpose: progress is honest, one rejected write
 * stops with the rest untouched rather than half-applied, and running the
 * same file again afterwards is a no-op because the planner deduplicates.
 *
 * Every create passes `announce: false` — hundreds of per-item feed rows
 * would drown the band — and the run logs **one** `bulk_imported` event.
 */
export const executeImportPlan = async (
  organizationId: string,
  plan: ImportPlan,
  author: { id: string; name: string },
  library: Map<string, Song>,
  onProgress: (done: number, total: number) => void,
): Promise<ImportResult> => {
  const songIdMap: Record<string, string> = { ...plan.songIdMap }
  const importLibrary = new Map(library)
  const total = plan.songs.length + plan.setlists.length + plan.performances.length
  let done = 0

  for (const draft of plan.songs) {
    const { id: fileId, ...input } = draft
    const newId = await createSong(organizationId, input, author, { announce: false })
    songIdMap[fileId] = newId
    importLibrary.set(newId, importedSong(draft, newId, organizationId, author))
    done += 1
    onProgress(done, total)
  }

  const setlistIdMap: Record<string, string> = { ...plan.setlistIdMap }
  for (const list of plan.setlists) {
    const newId = await createSetlist(
      organizationId,
      remapSetlistForImport(list, songIdMap),
      importLibrary,
      author,
      { announce: false },
    )
    // `createSetlist` always writes `template: false` — the flag that puts a
    // list on the templates shelf (#41) is its own write, so restore it here.
    if (list.template) await setSetlistTemplate(organizationId, newId, true, author)
    setlistIdMap[list.id] = newId
    done += 1
    onProgress(done, total)
  }

  for (const show of plan.performances) {
    const newId = await createPerformance(
      organizationId,
      remapPerformanceForImport(show, setlistIdMap),
      author,
      { announce: false },
    )
    if (show.showLog.length > 0) await saveShowLog(organizationId, newId, show.showLog)
    // Night notes (#90) ride the same restore, with their song references
    // re-anchored through the id map so the report still names the song; an
    // unmapped id keeps its old value and simply reads as a note about the
    // night, exactly like a show-log entry whose song is gone.
    if (show.showNotes.length > 0) {
      await saveShowNotes(
        organizationId,
        newId,
        show.showNotes.map((note) => ({
          ...note,
          songId: songIdMap[note.songId] ?? note.songId,
        })),
      )
    }
    done += 1
    onProgress(done, total)
  }

  const result: ImportResult = {
    songs: plan.songs.length,
    setlists: plan.setlists.length,
    performances: plan.performances.length,
  }
  if (total > 0) {
    const uid = requireUserId()
    void logActivity({
      organizationId,
      type: "bulk_imported",
      message:
        `${author.name} imported ${result.songs} songs, ` +
        `${result.setlists} setlists and ${result.performances} events`,
      actorId: uid,
      actorName: author.name,
      targetType: "organization",
      targetId: null,
    })
  }
  return result
}

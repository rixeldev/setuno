/**
 * The scheduled trash purge (roadmap #31's tail, shipped with P0.1) against
 * the Firestore emulator, through the **Admin SDK** — the same client the
 * deployed function uses, which bypasses the security rules exactly like
 * production does. A `demo-*` project id keeps this file's fixtures in their
 * own emulator namespace, so the rules suite next door never sees them.
 *
 * Run through `firebase emulators:exec --only firestore,storage "pnpm
 * test:integration"`, which exports the emulator host variables. The guard
 * below turns a bare run without an emulator into a loud error instead of a
 * connection attempt against production.
 */
import { deleteApp, initializeApp, type App } from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { purgeExpiredSongs } from "../../functions/src/purge"

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'trashPurge.test.ts needs the Firestore emulator: firebase emulators:exec --only firestore,storage "pnpm test:integration"',
  )
}

let app: App
let db: Firestore

beforeAll(() => {
  app = initializeApp({ projectId: "demo-setuno-trash" })
  db = getFirestore(app)
})

afterAll(async () => {
  await deleteApp(app)
})

/** Fresh ids per test so scenarios never share a document. */
const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
const DAY = 24 * 60 * 60 * 1000

describe("purgeExpiredSongs", () => {
  it("deletes the songs past the TTL with their versions and presence dots, sparing the rest", async () => {
    const now = new Date()
    const orgId = createId("org")
    const expiredId = createId("song")
    const freshId = createId("song")
    const liveMissingId = createId("song")
    const liveNullId = createId("song")

    const expired = db.doc(`organizations/${orgId}/songs/${expiredId}`)
    await expired.set({
      organizationId: orgId,
      title: "Expired draft",
      deletedAt: new Date(now.getTime() - 31 * DAY),
      deletedBy: "alice",
    })
    await expired.collection("versions").doc("v1").set({ id: "v1", savedAt: new Date(now.getTime() - 40 * DAY) })
    await expired.collection("versions").doc("v2").set({ id: "v2", savedAt: new Date(now.getTime() - 35 * DAY) })
    // Edit-presence dots (roadmap #28) ride the same cascade.
    await expired.collection("presence").doc("alice").set({ uid: "alice", displayName: "alice", updatedAt: new Date() })
    await expired.collection("presence").doc("bob").set({ uid: "bob", displayName: "bob", updatedAt: new Date() })
    await db.doc(`organizations/${orgId}/songs/${freshId}`).set({
      organizationId: orgId,
      title: "Trashed yesterday",
      deletedAt: new Date(now.getTime() - 1 * DAY),
      deletedBy: "alice",
    })
    // Both shapes a live song exists in: no `deletedAt` field at all, and the
    // explicit `null` that `restoreSong` writes. `null` orders before every
    // timestamp, so the purge query must spare both.
    await db.doc(`organizations/${orgId}/songs/${liveMissingId}`).set({ organizationId: orgId, title: "Live" })
    await db.doc(`organizations/${orgId}/songs/${liveNullId}`).set({
      organizationId: orgId,
      title: "Restored",
      deletedAt: null,
      deletedBy: null,
    })

    await expect(purgeExpiredSongs(db, now)).resolves.toEqual({ songs: 1, versions: 2, presence: 2 })

    expect((await expired.get()).exists).toBe(false)
    expect((await expired.collection("versions").get()).empty).toBe(true)
    expect((await expired.collection("presence").get()).empty).toBe(true)
    expect((await db.doc(`organizations/${orgId}/songs/${freshId}`).get()).exists).toBe(true)
    expect((await db.doc(`organizations/${orgId}/songs/${liveMissingId}`).get()).exists).toBe(true)
    expect((await db.doc(`organizations/${orgId}/songs/${liveNullId}`).get()).exists).toBe(true)
  })

  it("counts every expired song of the run, its versions and dots included", async () => {
    const now = new Date()
    const orgId = createId("org")
    for (let i = 0; i < 2; i += 1) {
      const song = db.doc(`organizations/${orgId}/songs/${createId("song")}`)
      await song.set({
        organizationId: orgId,
        title: `Expired ${i}`,
        deletedAt: new Date(now.getTime() - (31 + i) * DAY),
        deletedBy: "alice",
      })
      await song.collection("versions").doc("v1").set({ id: "v1" })
      await song.collection("presence").doc("alice").set({ uid: "alice", displayName: "alice", updatedAt: new Date() })
    }

    await expect(purgeExpiredSongs(db, now)).resolves.toEqual({ songs: 2, versions: 2, presence: 2 })
  })

  it("is a quiet no-op when nothing has expired", async () => {
    const now = new Date()
    const orgId = createId("org")
    await db.doc(`organizations/${orgId}/songs/${createId("song")}`).set({
      organizationId: orgId,
      title: "Freshly trashed",
      deletedAt: new Date(now.getTime() - 1 * DAY),
      deletedBy: "alice",
    })

    await expect(purgeExpiredSongs(db, now)).resolves.toEqual({ songs: 0, versions: 0, presence: 0 })
  })
})

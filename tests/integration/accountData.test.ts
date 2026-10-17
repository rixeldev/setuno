/**
 * The account export and deletion of roadmap #68 against the Firestore
 * emulator, through the **Admin SDK** — the same client the deployed callables
 * use, which bypasses the security rules exactly like production does (no rule
 * governs this feature; see `functions/src/accountData.ts`). A `demo-*`
 * project id keeps this file's fixtures in their own emulator namespace, so
 * the rules suite next door never sees them.
 *
 * What is deliberately **not** covered here: removing the Firebase Auth user.
 * That call is the thin `deleteMyAccount` shell in `functions/src/index.ts`
 * (`getAuth().deleteUser`), which needs the Auth emulator; the Firestore half
 * — every decision, cascade and succession — is what this file pins.
 *
 * Run through `firebase emulators:exec --only firestore,storage "pnpm
 * test:integration"`, which exports the emulator host variables. The guard
 * below turns a bare run without an emulator into a loud error instead of a
 * connection attempt against production.
 */
import { deleteApp, initializeApp, type App } from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { collectAccountExport, deleteAccountData } from "../../functions/src/accountData"

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'accountData.test.ts needs the Firestore emulator: firebase emulators:exec --only firestore,storage "pnpm test:integration"',
  )
}

let app: App
let db: Firestore

beforeAll(() => {
  app = initializeApp({ projectId: "demo-setuno-account" })
  db = getFirestore(app)
})

afterAll(async () => {
  await deleteApp(app)
})

/** Fresh ids per test so scenarios never share a document. */
const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
const MINUTE = 60_000

/** The band skeleton every scenario starts from: document plus membership. */
const seedBand = async (
  organizationId: string,
  name: string,
  ownerId: string,
  members: { uid: string; role: "admin" | "member"; joinedAt: Date }[],
): Promise<void> => {
  await db.doc(`organizations/${organizationId}`).set({ name, ownerId })
  for (const member of members) {
    await db.doc(`organizations/${organizationId}/members/${member.uid}`).set({
      uid: member.uid,
      displayName: member.uid,
      role: member.role,
      joinedAt: member.joinedAt,
    })
    await db.doc(`users/${member.uid}/organizations/${organizationId}`).set({
      name,
      role: member.role,
    })
  }
}

describe("collectAccountExport", () => {
  it("collects the profile, the bands, the songs — and only the account's own suggestions and activity", async () => {
    const uid = createId("u1")
    const bandId = createId("band")
    const strangerBandId = createId("band")
    const inviteBandId = createId("band")
    const email = "Me@Example.COM"
    const now = new Date()

    await db.doc(`users/${uid}`).set({ displayName: "rixel", email: "me@example.com" })
    await db.doc("usernames/rixel").set({ uid })
    await db.doc(`usernames/${createId("other")}`).set({ uid: createId("u2") })

    await seedBand(bandId, "Alpha", uid, [
      { uid, role: "admin", joinedAt: new Date(0) },
      { uid: createId("u2"), role: "member", joinedAt: new Date(MINUTE) },
    ])
    // A band this account does not belong to: its songs must never appear.
    const strangerSongId = createId("song")
    await db.doc(`organizations/${strangerBandId}`).set({ name: "Elsewhere", ownerId: createId("u9") })
    await db.doc(`organizations/${strangerBandId}/songs/${strangerSongId}`).set({
      title: "Elsewhere song",
    })

    const keptSongId = createId("song")
    await db.doc(`organizations/${bandId}/songs/${keptSongId}`).set({ title: "Alpha song" })
    await db.doc(`organizations/${bandId}/songs/${createId("song")}`).set({ title: "Second song" })

    const ownSuggestionId = createId("suggestion")
    await db.doc(`organizations/${bandId}/suggestions/${ownSuggestionId}`).set({
      authorId: uid,
      body: "Mine",
    })
    const otherSuggestionId = createId("suggestion")
    await db.doc(`organizations/${bandId}/suggestions/${otherSuggestionId}`).set({
      authorId: createId("u2"),
      body: "Theirs",
    })

    const ownEventId = createId("event")
    await db.doc(`organizations/${bandId}/activity/${ownEventId}`).set({
      actorId: uid,
      createdAt: new Date(MINUTE),
    })
    await db.doc(`organizations/${bandId}/activity/${createId("event")}`).set({
      actorId: createId("u2"),
      createdAt: new Date(2 * MINUTE),
    })

    // Invitations live under the *inviting* band and are keyed by the
    // lowercase address, whatever casing the export is queried with.
    await db.doc(`organizations/${inviteBandId}`).set({ name: "Gamma", ownerId: createId("u8") })
    await db.doc(`organizations/${inviteBandId}/invitations/me@example.com`).set({
      email: "me@example.com",
      organizationId: inviteBandId,
      status: "pending",
    })
    await db.doc(`organizations/${inviteBandId}/invitations/other@example.com`).set({
      email: "other@example.com",
      organizationId: inviteBandId,
      status: "pending",
    })

    await db.doc(`users/${uid}/favorites/${keptSongId}`).set({ songId: keptSongId })
    await db.doc(`users/${uid}/devices/expo-token`).set({ token: "expo-token" })

    const account = await collectAccountExport(db, uid, email, now)

    expect(account.format).toBe("setuno-account-export")
    expect(account.exportedAt).toBe(now.toISOString())
    expect(account.profile).toMatchObject({ displayName: "rixel" })
    expect(account.username).toBe("rixel")
    expect(account.organizations).toHaveLength(1)
    expect(account.organizations[0]).toMatchObject({
      id: bandId,
      name: "Alpha",
      role: "admin",
      ownerId: uid,
    })
    expect(account.counts).toMatchObject({
      organizations: 1,
      songs: 2,
      suggestions: 1,
      activity: 1,
      invitations: 1,
      favorites: 1,
      devices: 1,
    })
    expect(account.suggestions[0]).toMatchObject({ id: ownSuggestionId, organizationId: bandId })
    expect(account.activity[0]).toMatchObject({ id: ownEventId, organizationId: bandId })
    expect(account.invitations[0]).toMatchObject({
      id: "me@example.com",
      organizationId: inviteBandId,
    })
    expect(account.songs.map((song) => song.title).sort()).toEqual(["Alpha song", "Second song"])
    expect(account.songs.some((song) => song.id === strangerSongId)).toBe(false)

    // The app stringifies this document verbatim: a round trip must survive.
    expect(JSON.parse(JSON.stringify(account))).toMatchObject({
      format: "setuno-account-export",
      exportedAt: now.toISOString(),
    })
  })
})

describe("deleteAccountData", () => {
  it("walks out of every band, promotes an heir, deletes a solo band whole — and leaves everything else standing", async () => {
    const uid = createId("u1")
    const keepBandId = createId("band")
    const promoteBandId = createId("band")
    const soloBandId = createId("band")
    const otherUid = createId("u2")
    const thirdUid = createId("u3")

    // A band with another admin: the leaver's keys hand over to it.
    await seedBand(keepBandId, "Keep", uid, [
      { uid, role: "admin", joinedAt: new Date(0) },
      { uid: otherUid, role: "admin", joinedAt: new Date(MINUTE) },
    ])
    await db.doc(`organizations/${keepBandId}/songs/${createId("song")}`).set({ title: "Keeper" })

    // A band the leaver admins alone: the most senior member is promoted.
    await seedBand(promoteBandId, "Promote", uid, [
      { uid, role: "admin", joinedAt: new Date(0) },
      { uid: thirdUid, role: "member", joinedAt: new Date(3 * MINUTE) },
      { uid: otherUid, role: "member", joinedAt: new Date(2 * MINUTE) },
    ])
    await db.doc(`organizations/${promoteBandId}/songs/${createId("song")}`).set({ title: "Kept" })

    // A band with the leaver as its only member: deleted whole, nesting and
    // all — Firestore never cascades, so the tree walk is the only cascade.
    await seedBand(soloBandId, "Solo", uid, [
      { uid, role: "admin", joinedAt: new Date(0) },
    ])
    const soloSong = db.doc(`organizations/${soloBandId}/songs/${createId("song")}`)
    await soloSong.set({ title: "Ghost" })
    await soloSong.collection("versions").doc("v1").set({ savedAt: new Date(0) })
    const soloPerformance = db.doc(`organizations/${soloBandId}/performances/${createId("show")}`)
    await soloPerformance.set({ title: "Gig" })
    await soloPerformance.collection("tasks").doc("t1").set({ title: "Amp" })
    const soloPoll = db.doc(`organizations/${soloBandId}/datePolls/${createId("poll")}`)
    await soloPoll.set({ title: "When?" })
    await soloPoll.collection("votes").doc(otherUid).set({ optionIds: [] })
    const soloSuggestion = db.doc(`organizations/${soloBandId}/suggestions/${createId("idea")}`)
    await soloSuggestion.set({ authorId: uid, body: "Idea" })
    await soloSuggestion.collection("comments").doc("c1").set({ body: "Yes" })
    await db.doc(`organizations/${soloBandId}/setlists/${createId("list")}`).set({ name: "Main" })
    await db.doc(`organizations/${soloBandId}/checklists/${createId("list")}`).set({ name: "Gear" })
    await db.doc(`organizations/${soloBandId}/invitations/${createId("mail")}`).set({
      email: "someone@example.com",
    })
    await db.doc(`organizations/${soloBandId}/activity/${createId("event")}`).set({ actorId: uid })

    // The account itself: profile, mirrors, everything private, the claim.
    await db.doc(`users/${uid}`).set({ displayName: "rixel" })
    await db.doc("usernames/rixel").set({ uid })
    await db.doc(`users/${uid}/favorites/${createId("song")}`).set({ songId: createId("song") })
    await db.doc(`users/${uid}/collections/${createId("list")}`).set({ name: "Keep" })
    await db.doc(`users/${uid}/readerState/${createId("song")}`).set({ fontSize: 18 })
    await db.doc(`users/${uid}/annotations/${createId("song")}`).set({ notes: "Notes" })
    await db.doc(`users/${uid}/devices/expo-token`).set({ token: "expo-token" })
    await db.doc(`users/${uid}/activityRead/${keepBandId}`).set({ at: new Date(0) })

    // Somebody else's corner of the same emulator: none of this may move.
    await db.doc(`users/${otherUid}`).set({ displayName: "dos" })
    await db.doc(`usernames/otro`).set({ uid: otherUid })
    await db.doc(`users/${otherUid}/favorites/${createId("song")}`).set({ songId: createId("song") })

    await expect(deleteAccountData(db, uid)).resolves.toEqual({
      organizationsLeft: 2,
      organizationsDeleted: 1,
      adminsPromoted: 1,
    })

    // Keep band: the leaver is gone, the surviving admin owns it now.
    expect((await db.doc(`organizations/${keepBandId}/members/${uid}`).get()).exists).toBe(false)
    expect((await db.doc(`organizations/${keepBandId}`).get()).data()).toMatchObject({
      ownerId: otherUid,
    })
    expect((await db.doc(`organizations/${keepBandId}/members/${otherUid}`).get()).data()).toMatchObject({
      role: "admin",
    })

    // Promote band: the most senior member admins it — in the band's own
    // roster and in their private mirror, which must stay in step.
    expect((await db.doc(`organizations/${promoteBandId}/members/${uid}`).get()).exists).toBe(false)
    expect((await db.doc(`organizations/${promoteBandId}/members/${otherUid}`).get()).data()).toMatchObject(
      { role: "admin" },
    )
    expect(
      (await db.doc(`users/${otherUid}/organizations/${promoteBandId}`).get()).data(),
    ).toMatchObject({ role: "admin", name: "Promote" })
    expect((await db.doc(`organizations/${promoteBandId}`).get()).data()).toMatchObject({
      ownerId: otherUid,
    })
    expect((await db.collection(`organizations/${promoteBandId}/songs`).get()).size).toBe(1)

    // Solo band: the document and every layer under it are gone.
    expect((await db.doc(`organizations/${soloBandId}`).get()).exists).toBe(false)
    for (const path of [
      `organizations/${soloBandId}/songs`,
      `organizations/${soloBandId}/performances`,
      `organizations/${soloBandId}/datePolls`,
      `organizations/${soloBandId}/suggestions`,
      `organizations/${soloBandId}/setlists`,
      `organizations/${soloBandId}/checklists`,
      `organizations/${soloBandId}/invitations`,
      `organizations/${soloBandId}/activity`,
      `organizations/${soloBandId}/members`,
    ]) {
      expect((await db.collection(path).get()).empty).toBe(true)
    }
    expect((await soloSong.collection("versions").get()).empty).toBe(true)
    expect((await soloPerformance.collection("tasks").get()).empty).toBe(true)
    expect((await soloPoll.collection("votes").get()).empty).toBe(true)
    expect((await soloSuggestion.collection("comments").get()).empty).toBe(true)

    // The account: claim released, private documents and profile gone.
    expect((await db.doc("usernames/rixel").get()).exists).toBe(false)
    expect((await db.doc(`users/${uid}`).get()).exists).toBe(false)
    expect((await db.collection(`users/${uid}/favorites`).get()).empty).toBe(true)
    expect((await db.collection(`users/${uid}/devices`).get()).empty).toBe(true)
    expect((await db.collection(`users/${uid}/organizations`).get()).empty).toBe(true)

    // Nobody else lost a byte.
    expect((await db.doc(`users/${otherUid}`).get()).exists).toBe(true)
    expect((await db.doc("usernames/otro").get()).exists).toBe(true)
    expect((await db.collection(`users/${otherUid}/favorites`).get()).size).toBe(1)

    // A retry after a half-finished run is a quiet no-op — the mirror that
    // drives the whole plan is already gone.
    await expect(deleteAccountData(db, uid)).resolves.toEqual({
      organizationsLeft: 0,
      organizationsDeleted: 0,
      adminsPromoted: 0,
    })
  })
})

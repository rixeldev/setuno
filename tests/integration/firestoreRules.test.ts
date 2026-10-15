/**
 * The Firestore security rules (docs §23) against the emulator — the seed
 * suite described in `tests/integration/README.md`. The scenarios mirror its
 * contract: private profiles, admin-only song writes, suggestion review and
 * membership management, plus the owner-only reader state.
 *
 * Run through `firebase emulators:exec --only firestore,storage "pnpm
 * test:integration"`, which starts the emulators, exports their host variables
 * and runs this project. Files run serially (`vitest.config.mts`) and every
 * test starts from a cleared store with fresh ids, per the README.
 */
import { readFileSync } from "node:fs"

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

let env: RulesTestEnvironment

/** Fresh document id per test so scenarios never share a document. */
const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

const alice = () => env.authenticatedContext("alice")
const bob = () => env.authenticatedContext("bob")
const guest = () => env.unauthenticatedContext()

let orgId: string
let songId: string
let suggestionId: string

const songPath = () => `organizations/${orgId}/songs/${songId}`

/** The minimal shape the suggestions create rule accepts (11 of its 15 keys). */
const suggestion = (authorId: string) => ({
  organizationId: orgId,
  songId,
  songTitle: "Seed song",
  authorId,
  authorName: authorId,
  type: "chord",
  change: "transpose to G",
  summary: "Move to G",
  comment: "Kinder to the singer's range",
  status: "pending",
  createdAt: new Date(),
})

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-setuno-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  })
})

afterAll(() => env.cleanup())

beforeEach(async () => {
  orgId = createId("org")
  songId = createId("song")
  suggestionId = createId("suggestion")
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await db.doc("users/alice").set({
      uid: "alice",
      displayName: "alice",
      email: "alice@example.com",
      photoURL: "",
      organizationIds: [],
      activeOrganizationId: "",
      preferences: {},
      onboarded: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    for (const [uid, role] of [
      ["alice", "admin"],
      ["bob", "member"],
    ] as const) {
      await db.doc(`organizations/${orgId}/members/${uid}`).set({
        uid,
        displayName: uid,
        email: `${uid}@example.com`,
        photoURL: "",
        role,
        joinedAt: new Date(),
        invitedBy: "",
      })
    }
    await db.doc(songPath()).set({ organizationId: orgId, title: "Seed song", sections: [] })
    await db.doc(`organizations/${orgId}/suggestions/${suggestionId}`).set(suggestion("bob"))
  })
})

describe("profiles are private", () => {
  it("lets the owner read their own profile", async () => {
    const snapshot = await assertSucceeds(alice().firestore().doc("users/alice").get())
    expect(snapshot.exists).toBe(true)
  })

  it("hides it from another member", async () => {
    await assertFails(bob().firestore().doc("users/alice").get())
  })

  it("hides it from signed-out visitors", async () => {
    await assertFails(guest().firestore().doc("users/alice").get())
  })
})

describe("songs are written by admins only", () => {
  it("lets an admin create a song", async () => {
    const id = createId("song")
    await assertSucceeds(
      alice()
        .firestore()
        .doc(`organizations/${orgId}/songs/${id}`)
        .set({ organizationId: orgId, title: "New song", sections: [] }),
    )
  })

  it("denies a member creating one", async () => {
    const id = createId("song")
    await assertFails(
      bob()
        .firestore()
        .doc(`organizations/${orgId}/songs/${id}`)
        .set({ organizationId: orgId, title: "New song", sections: [] }),
    )
  })

  it("denies a member editing the band's song", async () => {
    await assertFails(bob().firestore().doc(songPath()).update({ title: "Renamed" }))
  })

  it("lets an admin edit the band's song", async () => {
    await assertSucceeds(alice().firestore().doc(songPath()).update({ title: "Renamed" }))
  })
})

describe("suggestions are member-written and admin-reviewed", () => {
  it("lets a member file a pending suggestion", async () => {
    const id = createId("suggestion")
    await assertSucceeds(
      bob()
        .firestore()
        .doc(`organizations/${orgId}/suggestions/${id}`)
        .set(suggestion("bob")),
    )
  })

  it("rejects an author id that is not the caller", async () => {
    const id = createId("suggestion")
    await assertFails(
      bob()
        .firestore()
        .doc(`organizations/${orgId}/suggestions/${id}`)
        .set(suggestion("alice")),
    )
  })

  it("stops the author resolving their own suggestion", async () => {
    await assertFails(
      bob()
        .firestore()
        .doc(`organizations/${orgId}/suggestions/${suggestionId}`)
        .update({ status: "accepted" }),
    )
  })

  it("lets an admin resolve it", async () => {
    await assertSucceeds(
      alice()
        .firestore()
        .doc(`organizations/${orgId}/suggestions/${suggestionId}`)
        .update({
          status: "accepted",
          reviewedBy: "alice",
          reviewedByName: "alice",
          reviewedAt: new Date(),
          reviewNote: "Good catch",
        }),
    )
  })
})

describe("membership is admin territory", () => {
  it("denies a member inviting anybody", async () => {
    const email = `${createId("invitee")}@example.com`
    await assertFails(
      bob()
        .firestore()
        .doc(`organizations/${orgId}/invitations/${email}`)
        .set({
          organizationId: orgId,
          organizationName: "The band",
          email,
          role: "member",
          status: "pending",
          invitedBy: "bob",
          invitedByName: "bob",
          createdAt: new Date(),
          respondedAt: null,
        }),
    )
  })

  it("stops anybody promoting themselves", async () => {
    await assertFails(
      bob().firestore().doc(`organizations/${orgId}/members/bob`).update({ role: "admin" }),
    )
  })

  it("lets an admin change another member's role", async () => {
    await assertSucceeds(
      alice().firestore().doc(`organizations/${orgId}/members/bob`).update({ role: "admin" }),
    )
  })
})

describe("reader state is private and validated", () => {
  const state = (fontSize: number) => ({
    autoscrollSpeed: 120,
    autoscrollDelay: 5,
    scrollRatio: 0.4,
    semitones: 0,
    capo: 0,
    fontSize,
  })

  it("hides one member's state from another", async () => {
    await assertFails(bob().firestore().doc(`users/alice/readerState/${songId}`).get())
  })

  it("accepts the owner's valid state", async () => {
    await assertSucceeds(
      alice().firestore().doc(`users/alice/readerState/${songId}`).set(state(16)),
    )
  })

  it("rejects a font size outside the 13..30 range", async () => {
    await assertFails(alice().firestore().doc(`users/alice/readerState/${songId}`).set(state(99)))
  })
})

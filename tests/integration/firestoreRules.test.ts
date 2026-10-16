/**
 * The Firestore security rules (docs §23) against the emulator — the seed
 * suite described in `tests/integration/README.md`. The scenarios mirror its
 * contract: private profiles, admin-only song writes, suggestion review,
 * membership management, the owner-only reader state, the song version
 * history (roadmap #26), the performances' event type (roadmap #46), the
 * member-writable show log (roadmap #45) and the event's attendance map and
 * "who brings what" tasks (roadmap #47).
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

  it("lets an admin change a song's status", async () => {
    await assertSucceeds(alice().firestore().doc(songPath()).update({ status: "retired" }))
  })

  it("still rejects an update carrying a field outside the whitelist", async () => {
    await assertFails(
      alice().firestore().doc(songPath()).update({ status: "retired", metadata: { source: "import" } }),
    )
  })

  it("lets an admin move a song to the trash", async () => {
    await assertSucceeds(
      alice().firestore().doc(songPath()).update({ deletedAt: new Date(), deletedBy: "alice" }),
    )
  })

  it("lets an admin restore a trashed song", async () => {
    await assertSucceeds(
      alice().firestore().doc(songPath()).update({ deletedAt: null, deletedBy: null }),
    )
  })
})

describe("performances carry their type (#46)", () => {
  /** The minimal body the performances create rule accepts. */
  const show = (overrides: Record<string, unknown> = {}) => ({
    organizationId: orgId,
    name: "Sala Sur",
    date: "2026-10-13",
    setlists: [],
    venue: { name: "Sala Sur", address: "", notes: "" },
    status: "scheduled",
    ...overrides,
  })
  const pathFor = (id: string) => `organizations/${orgId}/performances/${id}`

  const seedShow = async (overrides: Record<string, unknown> = {}): Promise<string> => {
    const id = createId("show")
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(pathFor(id)).set(show({ type: "gig", ...overrides }))
    })
    return id
  }

  it("denies a member creating one", async () => {
    await assertFails(
      bob().firestore().doc(pathFor(createId("show"))).set(show({ type: "rehearsal" })),
    )
  })

  it("lets an admin create an event with a type", async () => {
    await assertSucceeds(
      alice().firestore().doc(pathFor(createId("show"))).set(show({ type: "rehearsal" })),
    )
  })

  it("still lets an older client create one without a type", async () => {
    // The field is absent on documents written before roadmap #46, so a client
    // that has not been updated must keep working (it reads back as a gig).
    await assertSucceeds(alice().firestore().doc(pathFor(createId("show"))).set(show()))
  })

  it("rejects an unknown type value", async () => {
    await assertFails(
      alice().firestore().doc(pathFor(createId("show"))).set(show({ type: "open-mic" })),
    )
  })

  it("lets an admin change the type", async () => {
    const id = await seedShow()
    await assertSucceeds(alice().firestore().doc(pathFor(id)).update({ type: "rehearsal" }))
  })

  it("still rejects an update carrying a field outside the whitelist", async () => {
    const id = await seedShow()
    await assertFails(
      alice().firestore().doc(pathFor(id)).update({ type: "gig", mood: "nervous" }),
    )
  })
})

describe("the show log is a member-writable record (#45)", () => {
  const entry = (songId: string) => ({
    songId,
    outcome: "played",
    actualSec: 210,
    note: "",
    updatedAt: 1_760_000_000_000,
  })
  const pathFor = (id: string) => `organizations/${orgId}/performances/${id}`

  const seedLoggedShow = async (): Promise<string> => {
    const id = createId("show")
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(pathFor(id)).set({
        organizationId: orgId,
        name: "Sala Sur",
        date: "2026-10-13",
        setlists: [],
        venue: { name: "Sala Sur", address: "", notes: "" },
        status: "completed",
        type: "gig",
      })
    })
    return id
  }

  it("lets a member write the show log and the updatedAt touch alone", async () => {
    const id = await seedLoggedShow()
    await assertSucceeds(
      bob()
        .firestore()
        .doc(pathFor(id))
        .update({ showLog: [entry("song-a")], updatedAt: new Date() }),
    )
  })

  it("still denies a member touching any other field of the event", async () => {
    const id = await seedLoggedShow()
    await assertFails(
      bob()
        .firestore()
        .doc(pathFor(id))
        .update({ showLog: [entry("song-a")], status: "cancelled" }),
    )
  })

  it("lets an admin write the log through the same carve-out", async () => {
    const id = await seedLoggedShow()
    await assertSucceeds(
      alice()
        .firestore()
        .doc(pathFor(id))
        .update({ showLog: [entry("song-a"), entry("song-b")], updatedAt: new Date() }),
    )
  })

  it("rejects a show log that is not a list", async () => {
    const id = await seedLoggedShow()
    await assertFails(
      bob()
        .firestore()
        .doc(pathFor(id))
        .update({ showLog: { songId: "song-a" }, updatedAt: new Date() }),
    )
  })

  it("rejects a show log past the entry cap", async () => {
    const id = await seedLoggedShow()
    const oversized = Array.from({ length: 501 }, (_, index) => entry(`song-${index}`))
    await assertFails(
      bob().firestore().doc(pathFor(id)).update({ showLog: oversized, updatedAt: new Date() }),
    )
  })
})

describe("event logistics: attendance and tasks (#47)", () => {
  const pathFor = (id: string) => `organizations/${orgId}/performances/${id}`
  const taskPathFor = (id: string) => `${pathFor(id)}/tasks`

  const task = (createdBy: string, over: Record<string, unknown> = {}) => ({
    title: "Amplifier",
    assignedTo: "",
    done: false,
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  })

  const seedShow = async (extra: Record<string, unknown> = {}): Promise<string> => {
    const id = createId("show")
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(pathFor(id)).set({
        organizationId: orgId,
        name: "Sala Sur",
        date: "2026-10-13",
        setlists: [],
        venue: { name: "Sala Sur", address: "", notes: "" },
        status: "scheduled",
        type: "gig",
        ...extra,
      })
    })
    return id
  }

  const seedTask = async (id: string, createdBy: string): Promise<string> => {
    const taskId = createId("task")
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`${taskPathFor(id)}/${taskId}`).set(task(createdBy))
    })
    return taskId
  }

  it("lets a member answer for themselves, creating the map", async () => {
    const id = await seedShow()
    await assertSucceeds(
      bob().firestore().doc(pathFor(id)).update({
        "attendance.bob": "yes",
        updatedAt: new Date(),
      }),
    )
  })

  it("lets a member change their own key inside an existing map", async () => {
    const id = await seedShow({ attendance: { alice: "yes" } })
    await assertSucceeds(
      bob().firestore().doc(pathFor(id)).update({
        "attendance.bob": "maybe",
        updatedAt: new Date(),
      }),
    )
  })

  it("never lets a member answer (or retract) for another member", async () => {
    const id = await seedShow({ attendance: { alice: "yes" } })
    await assertFails(
      bob().firestore().doc(pathFor(id)).update({
        "attendance.alice": "no",
        updatedAt: new Date(),
      }),
    )
  })

  it("rejects a member answer that touches any other event field", async () => {
    const id = await seedShow()
    await assertFails(
      bob().firestore().doc(pathFor(id)).update({
        "attendance.bob": "yes",
        status: "cancelled",
        updatedAt: new Date(),
      }),
    )
  })

  it("rejects an answer outside the three states", async () => {
    const id = await seedShow()
    await assertFails(
      bob().firestore().doc(pathFor(id)).update({
        "attendance.bob": "later",
        updatedAt: new Date(),
      }),
    )
  })

  it("lets an admin rewrite the whole map through the event whitelist", async () => {
    const id = await seedShow()
    await assertSucceeds(
      alice().firestore().doc(pathFor(id)).update({
        attendance: { alice: "yes", bob: "no" },
        updatedAt: new Date(),
      }),
    )
  })

  it("lets any member file a task in their own name", async () => {
    const id = await seedShow()
    await assertSucceeds(
      bob().firestore().doc(`${taskPathFor(id)}/${createId("task")}`).set(task("bob")),
    )
  })

  it("rejects a task filed in somebody else's name", async () => {
    const id = await seedShow()
    await assertFails(
      bob().firestore().doc(`${taskPathFor(id)}/${createId("task")}`).set(task("alice")),
    )
  })

  it("rejects a task with an empty or oversized title", async () => {
    const id = await seedShow()
    await assertFails(
      bob()
        .firestore()
        .doc(`${taskPathFor(id)}/${createId("task")}`)
        .set(task("bob", { title: "  " })),
    )
    await assertFails(
      bob()
        .firestore()
        .doc(`${taskPathFor(id)}/${createId("task")}`)
        .set(task("bob", { title: "x".repeat(121) })),
    )
  })

  it("lets any member tick a task without touching its authorship", async () => {
    const id = await seedShow()
    const taskId = await seedTask(id, "alice")
    await assertSucceeds(
      bob().firestore().doc(`${taskPathFor(id)}/${taskId}`).update({
        done: true,
        updatedAt: new Date(),
      }),
    )
  })

  it("rejects an update that rewrites who created the task", async () => {
    const id = await seedShow()
    const taskId = await seedTask(id, "alice")
    await assertFails(
      bob().firestore().doc(`${taskPathFor(id)}/${taskId}`).update({
        done: true,
        createdBy: "bob",
        updatedAt: new Date(),
      }),
    )
  })

  it("keeps deletion with its creator or an admin, never a bystander", async () => {
    const id = await seedShow()
    const aliceTask = await seedTask(id, "alice")
    const bobTask = await seedTask(id, "bob")
    // A fellow member who neither created it nor admins the band.
    await assertFails(bob().firestore().doc(`${taskPathFor(id)}/${aliceTask}`).delete())
    // Its own creator, and the band's admin.
    await assertSucceeds(bob().firestore().doc(`${taskPathFor(id)}/${bobTask}`).delete())
    await assertSucceeds(alice().firestore().doc(`${taskPathFor(id)}/${aliceTask}`).delete())
  })

  it("hides the task list from outsiders", async () => {
    const id = await seedShow()
    const taskId = await seedTask(id, "bob")
    await assertFails(guest().firestore().doc(`${taskPathFor(id)}/${taskId}`).get())
    await assertFails(
      guest().firestore().doc(`${taskPathFor(id)}/${createId("task")}`).set(task("guest")),
    )
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

describe("the activity read marker is a private stamp", () => {
  const markerPath = () => `users/alice/activityRead/${orgId}`

  it("hides one member's marker from another", async () => {
    await assertFails(bob().firestore().doc(markerPath()).get())
  })

  it("accepts the owner's stamp", async () => {
    await assertSucceeds(
      alice().firestore().doc(markerPath()).set({ lastActivityReadAt: new Date() }),
    )
  })

  it("rejects a marker carrying anything but the timestamp", async () => {
    await assertFails(
      alice()
        .firestore()
        .doc(markerPath())
        .set({ lastActivityReadAt: new Date(), readIds: ["act-1"] }),
    )
  })
})

describe("favorites and collections are private to their owner", () => {
  const starPath = (songId: string) => `users/alice/favorites/${songId}`
  const collectionPath = "users/alice/collections/col-1"
  const collection = (overrides: Record<string, unknown> = {}) => ({
    name: "Sunday gig",
    songIds: ["s1", "s2"],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  it("hides one member's star from another", async () => {
    await assertFails(bob().firestore().doc(starPath("s1")).get())
  })

  it("accepts the owner's star", async () => {
    await assertSucceeds(alice().firestore().doc(starPath("s1")).set({ songId: "s1" }))
  })

  it("lets the owner remove a star", async () => {
    await assertSucceeds(alice().firestore().doc(starPath("s1")).set({ songId: "s1" }))
    await assertSucceeds(alice().firestore().doc(starPath("s1")).delete())
  })

  it("rejects a star whose body claims a different song", async () => {
    await assertFails(alice().firestore().doc(starPath("s1")).set({ songId: "s2" }))
  })

  it("hides one member's collections from another", async () => {
    await assertFails(bob().firestore().doc(collectionPath).get())
  })

  it("accepts the owner's collection", async () => {
    await assertSucceeds(alice().firestore().doc(collectionPath).set(collection()))
  })

  it("rejects a collection carrying extra fields", async () => {
    await assertFails(alice().firestore().doc(collectionPath).set(collection({ shared: true })))
  })

  it("rejects an empty collection name", async () => {
    await assertFails(alice().firestore().doc(collectionPath).set(collection({ name: "" })))
  })
})

describe("song versions are an admin-written, member-readable history", () => {
  /** The shape `services/songVersions.ts` writes — one immutable snapshot. */
  const version = (savedBy: string, overrides: Record<string, unknown> = {}) => ({
    data: { title: "Seed song", sections: [] },
    savedAt: new Date(),
    savedBy,
    savedByName: savedBy,
    ...overrides,
  })

  const versionPath = (id: string) => `${songPath()}/versions/${id}`

  it("lets an admin save a version", async () => {
    await assertSucceeds(alice().firestore().doc(versionPath(createId("v"))).set(version("alice")))
  })

  it("denies a member saving one", async () => {
    await assertFails(bob().firestore().doc(versionPath(createId("v"))).set(version("bob")))
  })

  it("rejects a snapshot credited to somebody else", async () => {
    await assertFails(alice().firestore().doc(versionPath(createId("v"))).set(version("bob")))
  })

  it("rejects keys outside the documented shape", async () => {
    await assertFails(
      alice()
        .firestore()
        .doc(versionPath(createId("v")))
        .set({ ...version("alice"), extra: true }),
    )
  })

  it("rejects a snapshot that could not be restored", async () => {
    await assertFails(
      alice()
        .firestore()
        .doc(versionPath(createId("v")))
        .set(version("alice", { data: { title: "", sections: [] } })),
    )
  })

  it("lets a member read the history", async () => {
    const id = createId("v")
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(versionPath(id)).set(version("alice"))
    })
    const snapshot = await assertSucceeds(bob().firestore().doc(versionPath(id)).get())
    expect(snapshot.exists).toBe(true)
  })

  it("hides the history from signed-out visitors", async () => {
    const id = createId("v")
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(versionPath(id)).set(version("alice"))
    })
    await assertFails(guest().firestore().doc(versionPath(id)).get())
  })

  it("freezes versions: nobody edits one, not even an admin", async () => {
    const id = createId("v")
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(versionPath(id)).set(version("alice"))
    })
    await assertFails(alice().firestore().doc(versionPath(id)).update({ savedByName: "rewritten" }))
  })

  it("lets an admin prune the oldest", async () => {
    const id = createId("v")
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(versionPath(id)).set(version("alice"))
    })
    await assertSucceeds(alice().firestore().doc(versionPath(id)).delete())
  })

  it("denies a member pruning", async () => {
    const id = createId("v")
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(versionPath(id)).set(version("alice"))
    })
    await assertFails(bob().firestore().doc(versionPath(id)).delete())
  })
})

/**
 * The Firestore security rules (docs §23) against the emulator — the seed
 * suite described in `tests/integration/README.md`. The scenarios mirror its
 * contract: private profiles, admin-only song writes, suggestion review,
 * membership management, the owner-only reader state, the song version
 * history (roadmap #26), the performances' event type (roadmap #46), the
 * member-writable show log (roadmap #45), the event's attendance map and
 * "who brings what" tasks (roadmap #47), the member-proposed date polls
 * (roadmap #48), the suggestion comment threads (roadmap #55), the
 * owner-only push registrations (roadmap #52), the anonymous share-link
 * snapshots (roadmap #56), the live setlist positions a member may write
 * onto them (roadmap #57), the read-only guest role that reads the band's
 * music and logistics while every collaboration surface stays denied
 * (roadmap #59), the one-field suggestion assignments any member writes
 * (roadmap #58), the song edit-presence dots only their own owner may stamp
 * (roadmap #28), the opt-in directory plus the join requests that can only
 * ever mint an invitation (roadmap #60) and the attachment list an admin
 * appends one field at a time (roadmap #40).
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

  // --- attachments (#40): the write-through touches one field and the cap is
  // pinned where the client cannot reach (rules cannot iterate the list, so
  // entries themselves are sanitized in libs/songAttachments.ts).
  const attachment = (id: string) => ({
    id,
    kind: "link",
    name: "Chart",
    url: "https://example.com/chart.pdf",
    path: "",
    size: 0,
    note: "",
    uploadedBy: "alice",
    uploadedByName: "alice",
    uploadedAt: new Date(),
  })

  it("lets an admin attach files and links", async () => {
    await assertSucceeds(
      alice().firestore().doc(songPath()).update({ attachments: [attachment("att_1")] }),
    )
  })

  it("denies a member attaching anything", async () => {
    await assertFails(
      bob().firestore().doc(songPath()).update({ attachments: [attachment("att_1")] }),
    )
  })

  it("rejects an attachment list past the 20-entry cap", async () => {
    const oversized = Array.from({ length: 21 }, (_, index) => attachment(`att_${index}`))
    await assertFails(alice().firestore().doc(songPath()).update({ attachments: oversized }))
  })

  it("rejects an attachments value that is not a list", async () => {
    await assertFails(alice().firestore().doc(songPath()).update({ attachments: "chart.pdf" }))
  })

  it("keeps accepting an unrelated update on a song that carries attachments", async () => {
    await assertSucceeds(
      alice().firestore().doc(songPath()).update({ attachments: [attachment("att_1")] }),
    )
    await assertSucceeds(alice().firestore().doc(songPath()).update({ status: "retired" }))
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

describe("date polls are member-proposed and admin-closed (#48)", () => {
  const pathFor = (id: string) => `organizations/${orgId}/datePolls/${id}`

  const poll = (createdBy: string, over: Record<string, unknown> = {}) => ({
    organizationId: orgId,
    title: "Summer gig — which date?",
    options: [
      { id: "o1", date: "2026-07-12", time: "", note: "" },
      { id: "o2", date: "2026-07-13", time: "21:00", note: "" },
    ],
    status: "open",
    winningOptionId: "",
    createdEventId: "",
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  })

  const vote = (over: Record<string, unknown> = {}) => ({
    optionIds: ["o1"],
    updatedAt: new Date(),
    ...over,
  })

  const seedPoll = async (
    createdBy = "alice",
    over: Record<string, unknown> = {},
  ): Promise<string> => {
    const id = createId("poll")
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(pathFor(id)).set(poll(createdBy, over))
    })
    return id
  }

  it("lets any member propose dates — logistics, not an admin job", async () => {
    await assertSucceeds(
      bob().firestore().doc(pathFor(createId("poll"))).set(poll("bob")),
    )
  })

  it("rejects a poll born closed, pre-winned or pre-linked to an event", async () => {
    await assertFails(
      alice().firestore().doc(pathFor(createId("poll"))).set(poll("alice", { status: "closed" })),
    )
    await assertFails(
      alice()
        .firestore()
        .doc(pathFor(createId("poll")))
        .set(poll("alice", { winningOptionId: "o1" })),
    )
    await assertFails(
      alice()
        .firestore()
        .doc(pathFor(createId("poll")))
        .set(poll("alice", { createdEventId: "some-event" })),
    )
  })

  it("rejects a poll with an empty title, too few or too many dates", async () => {
    await assertFails(
      bob().firestore().doc(pathFor(createId("poll"))).set(poll("bob", { title: "   " })),
    )
    await assertFails(
      bob()
        .firestore()
        .doc(pathFor(createId("poll")))
        .set(poll("bob", { options: [{ id: "o1", date: "2026-07-12" }] })),
    )
    await assertFails(
      bob()
        .firestore()
        .doc(pathFor(createId("poll")))
        .set(
          poll("bob", {
            options: Array.from({ length: 11 }, (_, index) => ({
              id: `o${index}`,
              date: "2026-07-12",
            })),
          }),
        ),
    )
  })

  it("rejects a poll filed under somebody else's name", async () => {
    await assertFails(
      bob().firestore().doc(pathFor(createId("poll"))).set(poll("alice")),
    )
  })

  it("keeps poll edits with admins while the band may still read them", async () => {
    const id = await seedPoll()
    await assertFails(
      bob().firestore().doc(pathFor(id)).update({ title: "Renamed by Bob", updatedAt: new Date() }),
    )
    await assertSucceeds(
      alice().firestore().doc(pathFor(id)).update({ title: "Renamed by Alice", updatedAt: new Date() }),
    )
    await assertFails(guest().firestore().doc(pathFor(id)).get())
  })

  it("lets an admin close the poll on its winner", async () => {
    const id = await seedPoll()
    await assertSucceeds(
      alice()
        .firestore()
        .doc(pathFor(id))
        .update({ status: "closed", winningOptionId: "o1", updatedAt: new Date() }),
    )
  })

  it("lets an admin record the event created from the winner", async () => {
    const id = await seedPoll()
    await assertSucceeds(
      alice()
        .firestore()
        .doc(pathFor(id))
        .update({ createdEventId: "event-1", updatedAt: new Date() }),
    )
  })

  it("never lets a member close the poll", async () => {
    const id = await seedPoll()
    await assertFails(
      bob()
        .firestore()
        .doc(pathFor(id))
        .update({ status: "closed", winningOptionId: "o1", updatedAt: new Date() }),
    )
  })

  it("lets a member vote in their own document, twice", async () => {
    const id = await seedPoll()
    const ref = () => bob().firestore().doc(`${pathFor(id)}/votes/bob`)
    await assertSucceeds(ref().set(vote()))
    // Rewritten whole on the next tick — no array union anywhere.
    await assertSucceeds(ref().set(vote({ optionIds: ["o1", "o2"] })))
    await assertSucceeds(ref().set(vote({ optionIds: [] })))
  })

  it("rejects a vote for somebody else or carrying extra fields", async () => {
    const id = await seedPoll()
    await assertFails(
      bob().firestore().doc(`${pathFor(id)}/votes/alice`).set(vote()),
    )
    await assertFails(
      bob().firestore().doc(`${pathFor(id)}/votes/bob`).set(vote({ votedFor: "alice" })),
    )
    await assertFails(
      bob().firestore().doc(`${pathFor(id)}/votes/bob`).set(vote({ optionIds: "o1" })),
    )
  })

  it("lets the voter retract their own vote, never another member's", async () => {
    const id = await seedPoll()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`${pathFor(id)}/votes/alice`).set(vote())
    })
    await assertFails(bob().firestore().doc(`${pathFor(id)}/votes/alice`).delete())
    await assertSucceeds(bob().firestore().doc(`${pathFor(id)}/votes/bob`).delete())
  })

  it("keeps poll deletion with its creator or an admin, never a bystander", async () => {
    const id = await seedPoll("bob")
    const otherId = await seedPoll("alice")
    // A fellow member who neither created it nor admins the band.
    await assertFails(bob().firestore().doc(pathFor(otherId)).delete())
    // Its own creator, and the band's admin.
    await assertSucceeds(bob().firestore().doc(pathFor(id)).delete())
    await assertSucceeds(alice().firestore().doc(pathFor(otherId)).delete())
  })
})

describe("reusable checklists are member-maintained (#49)", () => {
  const pathFor = (id: string) => `organizations/${orgId}/checklists/${id}`

  const checklist = (createdBy: string, over: Record<string, unknown> = {}) => ({
    organizationId: orgId,
    name: "Full rig",
    kind: "gear",
    items: ["2 x powered speakers", "DI boxes", "Speaker stands"],
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  })

  const seedChecklist = async (
    createdBy = "alice",
    over: Record<string, unknown> = {},
  ): Promise<string> => {
    const id = createId("checklist")
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(pathFor(id)).set(checklist(createdBy, over))
    })
    return id
  }

  it("lets any member maintain the band's checklists — logistics, not an admin job", async () => {
    await assertSucceeds(
      bob().firestore().doc(pathFor(createId("checklist"))).set(checklist("bob")),
    )
  })

  it("rejects an empty name, an unknown kind and an empty item list", async () => {
    await assertFails(
      bob().firestore().doc(pathFor(createId("checklist"))).set(checklist("bob", { name: "   " })),
    )
    await assertFails(
      bob()
        .firestore()
        .doc(pathFor(createId("checklist")))
        .set(checklist("bob", { kind: "backline" })),
    )
    await assertFails(
      bob().firestore().doc(pathFor(createId("checklist"))).set(checklist("bob", { items: [] })),
    )
  })

  it("rejects a checklist too big for an event's whole task budget", async () => {
    await assertFails(
      bob()
        .firestore()
        .doc(pathFor(createId("checklist")))
        .set(
          checklist("bob", {
            items: Array.from({ length: 51 }, (_, index) => `Item ${index}`),
          }),
        ),
    )
  })

  it("rejects a checklist filed under somebody else's name or carrying extra fields", async () => {
    await assertFails(
      bob().firestore().doc(pathFor(createId("checklist"))).set(checklist("alice")),
    )
    await assertFails(
      bob()
        .firestore()
        .doc(pathFor(createId("checklist")))
        .set(checklist("bob", { shared: true })),
    )
  })

  it("lets a member edit the content while the author never moves", async () => {
    const id = await seedChecklist("bob")
    await assertSucceeds(
      bob()
        .firestore()
        .doc(pathFor(id))
        .update({
          name: "Full rig — summer",
          kind: "setup",
          items: ["Amps"],
          updatedAt: new Date(),
        }),
    )
    await assertFails(
      bob().firestore().doc(pathFor(id)).update({ createdBy: "alice", updatedAt: new Date() }),
    )
    await assertFails(
      bob().firestore().doc(pathFor(id)).update({ kind: "backline", updatedAt: new Date() }),
    )
  })

  it("refuses to empty the list through an edit", async () => {
    const id = await seedChecklist()
    await assertFails(
      bob().firestore().doc(pathFor(id)).update({ items: [], updatedAt: new Date() }),
    )
  })

  it("keeps the band's reading open and signed-out visitors out", async () => {
    const id = await seedChecklist()
    const snapshot = await assertSucceeds(bob().firestore().doc(pathFor(id)).get())
    expect(snapshot.exists).toBe(true)
    await assertFails(guest().firestore().doc(pathFor(id)).get())
  })

  it("keeps deletion with its creator or an admin, never a bystander", async () => {
    const bobsId = await seedChecklist("bob")
    const othersId = await seedChecklist("alice")
    await assertFails(bob().firestore().doc(pathFor(othersId)).delete())
    await assertSucceeds(bob().firestore().doc(pathFor(bobsId)).delete())
    await assertSucceeds(alice().firestore().doc(pathFor(othersId)).delete())
  })

  it("stamps an attach's tasks with no new rule — #47's own shape", async () => {
    const id = await seedChecklist("bob")
    await assertSucceeds(
      bob()
        .firestore()
        .doc(`organizations/${orgId}/performances/perf-1/tasks/task-${id}`)
        .set({
          title: "2 x powered speakers",
          assignedTo: "",
          done: false,
          createdBy: "bob",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
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

describe("suggestion assignments are lightweight member writes (#58)", () => {
  const assignPath = (id = suggestionId) => `organizations/${orgId}/suggestions/${id}`

  it("lets any member assign a pending suggestion — and clear it again", async () => {
    await assertSucceeds(
      bob().firestore().doc(assignPath()).update({ assigneeId: "alice" }),
    )
    await assertSucceeds(
      bob().firestore().doc(assignPath()).update({ assigneeId: "" }),
    )
  })

  it("lets the author claim their own suggestion", async () => {
    await assertSucceeds(
      bob().firestore().doc(assignPath()).update({ assigneeId: "bob" }),
    )
  })

  it("stops an update that touches the assignment and anything else", async () => {
    await assertFails(
      bob()
        .firestore()
        .doc(assignPath())
        .update({ assigneeId: "alice", summary: "Renamed" }),
    )
  })

  it("stops assigning a suggestion that was already reviewed", async () => {
    await assertSucceeds(
      alice()
        .firestore()
        .doc(assignPath())
        .update({
          status: "rejected",
          reviewedBy: "alice",
          reviewedByName: "alice",
          reviewedAt: new Date(),
          reviewNote: "",
        }),
    )
    await assertFails(
      bob().firestore().doc(assignPath()).update({ assigneeId: "alice" }),
    )
  })

  it("stops an assignee id that is not a plain uid", async () => {
    await assertFails(
      bob().firestore().doc(assignPath()).update({ assigneeId: "x".repeat(129) }),
    )
    await assertFails(
      bob().firestore().doc(assignPath()).update({ assigneeId: 42 }),
    )
  })

  it("stops a create smuggling the field in", async () => {
    const id = createId("suggestion")
    await assertFails(
      bob()
        .firestore()
        .doc(assignPath(id))
        .set({ ...suggestion("bob"), assigneeId: "bob" }),
    )
  })
})

describe("join requests and the opt-in directory (#60)", () => {
  /** A signed-in stranger: no membership in this band, asking to join. */
  const dave = () => env.authenticatedContext("dave")
  const directoryPath = (id = orgId) => `discoverable/${id}`
  const requestPath = (uid = "dave", id = orgId) => `organizations/${id}/joinRequests/${uid}`

  const ask = (uid: string, over: Record<string, unknown> = {}) => ({
    uid,
    displayName: "Dave",
    email: "dave@example.com",
    note: "I play bass",
    createdAt: new Date(),
    status: "pending",
    ...over,
  })

  const seedOrg = async (over: Record<string, unknown> = {}, id = orgId): Promise<void> => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`organizations/${id}`)
        .set(
          { name: "The Wrens", description: "", logoURL: "", ownerId: "alice", ...over },
          { merge: true },
        )
    })
  }

  /** The band opted in: flag and directory entry, exactly like the app's batch. */
  const makeDiscoverable = async (): Promise<void> => {
    await seedOrg({ discoverable: true })
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(directoryPath()).set({ name: "The Wrens", nameKey: "the wrens" })
    })
  }

  const seedAsk = async (
    uid = "dave",
    id = orgId,
    over: Record<string, unknown> = {},
  ): Promise<void> => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(requestPath(uid, id)).set(ask(uid, over))
    })
  }

  it("lets a signed-in stranger find a band that opted in", async () => {
    await makeDiscoverable()
    await assertSucceeds(
      dave().firestore().collection("discoverable").where("nameKey", "==", "the wrens").limit(10).get(),
    )
  })

  it("denies the search to signed-out visitors", async () => {
    await makeDiscoverable()
    await assertFails(
      guest().firestore().collection("discoverable").where("nameKey", "==", "the wrens").limit(10).get(),
    )
  })

  it("denies every shape of a scan: sorts, offsets, big or missing limits", async () => {
    await makeDiscoverable()
    const db = dave().firestore()
    await assertFails(db.collection("discoverable").orderBy("nameKey").limit(10).get())
    await assertFails(db.collection("discoverable").where("nameKey", "==", "the wrens").limit(11).get())
    await assertFails(db.collection("discoverable").where("nameKey", "==", "the wrens").get())
  })

  it("lets the band's admin publish the entry with the flag in one batch", async () => {
    await seedOrg()
    const db = alice().firestore()
    const batch = db.batch()
    batch.update(db.doc(`organizations/${orgId}`), { discoverable: true, updatedAt: new Date() })
    batch.set(db.doc(directoryPath()), { name: "The Wrens", nameKey: "the wrens" })
    await assertSucceeds(batch.commit())
  })

  it("stops publishing the entry while the flag is off, and the reverse", async () => {
    await seedOrg()
    const db = alice().firestore()
    // The entry without the flag…
    await assertFails(db.doc(directoryPath()).set({ name: "The Wrens", nameKey: "the wrens" }))
    // …and the flag without the entry.
    const batch = db.batch()
    batch.update(db.doc(`organizations/${orgId}`), { discoverable: true, updatedAt: new Date() })
    await assertFails(batch.commit())
  })

  it("lets an admin opt out only by deleting the entry in the same batch", async () => {
    await makeDiscoverable()
    const db = alice().firestore()
    await assertFails(db.doc(directoryPath()).delete())
    const batch = db.batch()
    batch.update(db.doc(`organizations/${orgId}`), { discoverable: false, updatedAt: new Date() })
    batch.delete(db.doc(directoryPath()))
    await assertSucceeds(batch.commit())
  })

  it("stops another band's admin from publishing this band's entry", async () => {
    await makeDiscoverable()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`organizations/${createId("org")}/members/carol`).set({
        uid: "carol",
        displayName: "carol",
        email: "carol@example.com",
        photoURL: "",
        role: "admin",
        joinedAt: new Date(),
        invitedBy: "",
      })
    })
    await assertFails(
      env
        .authenticatedContext("carol")
        .firestore()
        .doc(directoryPath())
        .set({ name: "The Wrens", nameKey: "the wrens" }),
    )
  })

  it("stops a plain member from touching the entry", async () => {
    await makeDiscoverable()
    await assertFails(
      bob().firestore().doc(directoryPath()).set({ name: "Sneaky", nameKey: "sneaky" }),
    )
  })

  it("stops an entry that carries more than the name, or a name over the clamp", async () => {
    await seedOrg()
    const db = alice().firestore()
    const batch = db.batch()
    batch.update(db.doc(`organizations/${orgId}`), { discoverable: true, updatedAt: new Date() })
    batch.set(db.doc(directoryPath()), {
      name: "The Wrens",
      nameKey: "the wrens",
      email: "secret@example.com",
    })
    await assertFails(batch.commit())

    const oversized = db.batch()
    oversized.update(db.doc(`organizations/${orgId}`), { discoverable: true, updatedAt: new Date() })
    oversized.set(db.doc(directoryPath()), {
      name: "x".repeat(81),
      nameKey: "x".repeat(81),
    })
    await assertFails(oversized.commit())
  })

  it("stops a non-admin from setting the flag at all", async () => {
    await seedOrg()
    await assertFails(
      bob().firestore().doc(`organizations/${orgId}`).update({ discoverable: true }),
    )
  })

  it("lets a stranger ask to join, carrying only their own words", async () => {
    await assertSucceeds(dave().firestore().doc(requestPath()).set(ask("dave")))
  })

  it("stops asking in somebody else's name", async () => {
    await assertFails(
      dave().firestore().doc(requestPath("eve")).set(ask("eve")),
    )
  })

  it("stops a member or a guest from asking again", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`organizations/${orgId}/members/gus`).set({
        uid: "gus",
        displayName: "gus",
        email: "gus@example.com",
        photoURL: "",
        role: "guest",
        joinedAt: new Date(),
        invitedBy: "",
      })
    })
    await assertFails(bob().firestore().doc(requestPath("bob")).set(ask("bob")))
    await assertFails(
      env.authenticatedContext("gus").firestore().doc(requestPath("gus")).set(ask("gus")),
    )
  })

  it("stops a create that smuggles a field, skips pending or mangles the email", async () => {
    const db = dave().firestore()
    await assertFails(db.doc(requestPath()).set({ ...ask("dave"), role: "admin" }))
    await assertFails(db.doc(requestPath()).set(ask("dave", { status: "approved" })))
    await assertFails(db.doc(requestPath()).set(ask("dave", { email: "Dave@Example.com" })))
  })

  it("stops the requester from approving themselves", async () => {
    await seedAsk()
    await assertFails(
      dave().firestore().doc(requestPath()).update({ status: "approved" }),
    )
  })

  it("lets the requester withdraw and lets a rejected ask be asked again", async () => {
    await seedAsk()
    await assertSucceeds(dave().firestore().doc(requestPath()).delete())
    await assertSucceeds(dave().firestore().doc(requestPath()).set(ask("dave")))

    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(requestPath()).update({ status: "rejected" })
    })
    await assertSucceeds(
      dave().firestore().doc(requestPath()).update({ status: "pending", createdAt: new Date() }),
    )
  })

  it("lets an admin approve and reject with their own review stamps", async () => {
    await seedAsk()
    const db = alice().firestore()
    const stamps = {
      reviewedBy: "alice",
      reviewedByName: "alice",
      reviewedAt: new Date(),
    }
    await assertSucceeds(db.doc(requestPath()).update({ status: "approved", ...stamps }))
    await assertSucceeds(db.doc(requestPath()).update({ status: "rejected", ...stamps }))
  })

  it("stops an admin review that forgets who reviewed, or touches the ask", async () => {
    await seedAsk()
    const db = alice().firestore()
    await assertFails(db.doc(requestPath()).update({ status: "approved" }))
    await assertFails(
      db.doc(requestPath()).update({
        status: "rejected",
        reviewedBy: "alice",
        reviewedByName: "alice",
        reviewedAt: new Date(),
        displayName: "Sneaky",
      }),
    )
  })

  it("stops a plain member from reviewing, and a stranger from reading the queue", async () => {
    await seedAsk()
    await assertFails(
      bob().firestore().doc(requestPath()).update({ status: "rejected", reviewedBy: "bob" }),
    )
    await assertFails(bob().firestore().doc(requestPath()).get())
    await assertFails(guest().firestore().doc(requestPath()).get())
    await assertSucceeds(alice().firestore().doc(requestPath()).get())
    await assertSucceeds(dave().firestore().doc(requestPath()).get())
  })

  it("lets the admins list the band's queue and stops members from reading it", async () => {
    await seedAsk()
    const queue = alice().firestore().collection(`organizations/${orgId}/joinRequests`)
    await assertSucceeds(queue.orderBy("createdAt", "desc").get())
    await assertFails(
      bob().firestore().collection(`organizations/${orgId}/joinRequests`).orderBy("createdAt", "desc").get(),
    )
  })

  it("lets the requester find their own asks across bands and nobody else's", async () => {
    const otherOrg = createId("org")
    await seedAsk("dave", otherOrg)
    await seedAsk()
    await assertSucceeds(
      dave().firestore().collectionGroup("joinRequests").where("uid", "==", "dave").get(),
    )
    await assertFails(
      bob().firestore().collectionGroup("joinRequests").where("uid", "==", "dave").get(),
    )
  })
})

describe("suggestion comments are a member discussion (#55)", () => {
  const commentPath = (id = suggestionId) =>
    `organizations/${orgId}/suggestions/${id}/comments`

  const comment = (authorId: string, over: Record<string, unknown> = {}) => ({
    body: "Totally agree — G is kinder to the singer",
    authorId,
    authorName: authorId,
    createdAt: new Date(),
    deletedAt: null,
    ...over,
  })

  const seedComment = async (
    authorId = "bob",
    over: Record<string, unknown> = {},
  ): Promise<string> => {
    const id = createId("comment")
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`${commentPath()}/${id}`).set(comment(authorId, over))
    })
    return id
  }

  const seedMember = async (uid: string): Promise<void> => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`organizations/${orgId}/members/${uid}`).set({
        uid,
        displayName: uid,
        email: `${uid}@example.com`,
        photoURL: "",
        role: "member",
        joinedAt: new Date(),
        invitedBy: "",
      })
    })
  }

  it("lets a member comment on a suggestion", async () => {
    const id = createId("comment")
    await assertSucceeds(
      bob().firestore().doc(`${commentPath()}/${id}`).set(comment("bob")),
    )
  })

  it("stops a comment filed under someone else's name", async () => {
    const id = createId("comment")
    await assertFails(
      bob().firestore().doc(`${commentPath()}/${id}`).set(comment("alice")),
    )
  })

  it("stops an anonymous comment", async () => {
    const id = createId("comment")
    await assertFails(
      guest().firestore().doc(`${commentPath()}/${id}`).set(comment("ghost")),
    )
  })

  it("stops an empty body", async () => {
    const id = createId("comment")
    await assertFails(
      bob().firestore().doc(`${commentPath()}/${id}`).set(comment("bob", { body: "" })),
    )
  })

  it("counts the limit in characters, not bytes", async () => {
    // 1000 accented characters must pass and 1001 must fail — the same
    // number `sanitizeCommentBody` clamps to on the client.
    await assertSucceeds(
      bob()
        .firestore()
        .doc(`${commentPath()}/ok-${createId("comment")}`)
        .set(comment("bob", { body: "á".repeat(1000) })),
    )
    await assertFails(
      bob()
        .firestore()
        .doc(`${commentPath()}/over-${createId("comment")}`)
        .set(comment("bob", { body: "á".repeat(1001) })),
    )
  })

  it("stops a comment carrying fields outside the whitelist", async () => {
    const id = createId("comment")
    await assertFails(
      bob().firestore().doc(`${commentPath()}/${id}`).set(comment("bob", { read: true })),
    )
  })

  it("lets the author soften their comment into a tombstone", async () => {
    const id = await seedComment()
    await assertSucceeds(
      bob().firestore().doc(`${commentPath()}/${id}`).update({ deletedAt: new Date() }),
    )
  })

  it("lets an admin remove someone else's comment", async () => {
    const id = await seedComment("bob")
    await assertSucceeds(
      alice().firestore().doc(`${commentPath()}/${id}`).update({ deletedAt: new Date() }),
    )
  })

  it("never lets a comment be edited after it is posted", async () => {
    const id = await seedComment()
    await assertFails(
      bob().firestore().doc(`${commentPath()}/${id}`).update({ body: "rewritten" }),
    )
  })

  it("never lets another member remove a comment", async () => {
    await seedMember("charlie")
    const id = await seedComment("bob")
    await assertFails(
      env
        .authenticatedContext("charlie")
        .firestore()
        .doc(`${commentPath()}/${id}`)
        .update({ deletedAt: new Date() }),
    )
  })

  it("keeps removal irreversible", async () => {
    const id = await seedComment("bob", { deletedAt: new Date() })
    await assertFails(
      bob().firestore().doc(`${commentPath()}/${id}`).update({ deletedAt: null }),
    )
  })

  it("lets the author hard-delete — the cascade path", async () => {
    const id = await seedComment()
    await assertSucceeds(bob().firestore().doc(`${commentPath()}/${id}`).delete())
  })

  it("stops a non-member reading the thread", async () => {
    await seedComment()
    await assertFails(
      env.authenticatedContext("mallory").firestore().collection(commentPath()).get(),
    )
  })
})

describe("push registrations are a device's own business (#52)", () => {
  /** The document id is the token itself, brackets and all. */
  const deviceToken = () => `ExponentPushToken[${createId("device")}]`

  const registration = (token: string, overrides: Record<string, unknown> = {}) => ({
    token,
    platform: "android",
    lang: "en",
    lastSeenAt: new Date(),
    ...overrides,
  })

  it("lets the owner register and refresh this device", async () => {
    const token = deviceToken()
    const path = `users/alice/devices/${token}`
    await assertSucceeds(alice().firestore().doc(path).set(registration(token)))
    await assertSucceeds(alice().firestore().doc(path).update({ lastSeenAt: new Date() }))
  })

  it("lets the owner remove their own device", async () => {
    const token = deviceToken()
    const path = `users/alice/devices/${token}`
    await assertSucceeds(alice().firestore().doc(path).set(registration(token)))
    await assertSucceeds(alice().firestore().doc(path).delete())
  })

  it("rejects a body whose token is not the document id", async () => {
    await assertFails(
      alice()
        .firestore()
        .doc(`users/alice/devices/${deviceToken()}`)
        .set(registration(deviceToken())),
    )
  })

  it("stops another member from registering a device for you", async () => {
    const token = deviceToken()
    await assertFails(bob().firestore().doc(`users/alice/devices/${token}`).set(registration(token)))
  })

  it("hides one member's device list from another", async () => {
    await assertFails(bob().firestore().collection("users/alice/devices").get())
  })

  it("rejects a registration carrying an extra field", async () => {
    const token = deviceToken()
    await assertFails(
      alice()
        .firestore()
        .doc(`users/alice/devices/${token}`)
        .set(registration(token, { enabled: false })),
    )
  })

  it("rejects an unknown platform", async () => {
    const token = deviceToken()
    await assertFails(
      alice().firestore().doc(`users/alice/devices/${token}`).set(registration(token, { platform: "web" })),
    )
  })

  it("rejects an unsupported language", async () => {
    const token = deviceToken()
    await assertFails(
      alice().firestore().doc(`users/alice/devices/${token}`).set(registration(token, { lang: "fr" })),
    )
  })

  it("turns a guest away from a single device and the list alike", async () => {
    const token = deviceToken()
    await assertFails(guest().firestore().doc(`users/alice/devices/${token}`).get())
    await assertFails(guest().firestore().collection("users/alice/devices").get())
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

describe("share links are public, token-addressed snapshots (#56)", () => {
  const sharePath = (token: string) => `shares/${token}`

  const share = (overrides: Record<string, unknown> = {}) => ({
    version: 1,
    kind: "song",
    organizationId: orgId,
    sourceId: songId,
    title: "Seed song",
    payload: { artist: "", key: "G", capo: 0, bpm: null, durationSec: null, sections: [] },
    createdBy: "alice",
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: null,
    ...overrides,
  })

  const seedShare = async (token: string, overrides: Record<string, unknown> = {}) => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(sharePath(token)).set(share(overrides))
    })
  }

  it("lets anyone — signed in or not — read an active link", async () => {
    const token = createId("share")
    await seedShare(token)
    await assertSucceeds(guest().firestore().doc(sharePath(token)).get())
    await assertSucceeds(alice().firestore().doc(sharePath(token)).get())
  })

  it("answers a missing token with a plain miss, not an error", async () => {
    await assertSucceeds(guest().firestore().doc(sharePath(createId("missing"))).get())
  })

  it("reads an expired link as denied, so the app shows it as gone", async () => {
    const token = createId("share")
    await seedShare(token, { expiresAt: new Date(Date.now() - 60_000) })
    await assertFails(guest().firestore().doc(sharePath(token)).get())
    // Even the band's own members hit the same wall: expiry is the contract.
    await assertFails(alice().firestore().doc(sharePath(token)).get())
  })

  it("still serves a link that expires in the future", async () => {
    const token = createId("share")
    await seedShare(token, { expiresAt: new Date(Date.now() + 60_000) })
    await assertSucceeds(guest().firestore().doc(sharePath(token)).get())
  })

  it("never lets the collection be listed", async () => {
    await assertFails(guest().firestore().collection("shares").get())
    await assertFails(alice().firestore().collection("shares").get())
  })

  it("denies every client write: only the callables own the collection", async () => {
    const fresh = createId("share")
    await assertFails(alice().firestore().doc(sharePath(fresh)).set(share()))
    const seeded = createId("share")
    await seedShare(seeded)
    await assertFails(alice().firestore().doc(sharePath(seeded)).update({ title: "hijacked" }))
    await assertFails(alice().firestore().doc(sharePath(seeded)).delete())
    await assertFails(bob().firestore().doc(sharePath(seeded)).delete())
  })

  // ------------------------------------------------------------------ #57 --
  // The public live setlist: a member's client keeps the "current position"
  // fresh through one field-level carve-out — `live` and nothing else.

  const live = (overrides: Record<string, unknown> = {}) => ({
    songId: "song-live",
    position: 3,
    updatedAt: 1_760_000_000_000,
    ...overrides,
  })

  it("lets a band member refresh the live position and clear it again", async () => {
    const token = createId("share")
    await seedShare(token)
    await assertSucceeds(bob().firestore().doc(sharePath(token)).update({ live: live() }))
    await assertSucceeds(bob().firestore().doc(sharePath(token)).update({ live: null }))
  })

  it("never lets a live update touch anything else on the document", async () => {
    const token = createId("share")
    await seedShare(token)
    await assertFails(
      bob().firestore().doc(sharePath(token)).update({ live: live(), title: "hijacked" }),
    )
  })

  it("rejects a live value outside the pinned shape", async () => {
    const token = createId("share")
    await seedShare(token)
    for (const bad of [
      live({ songId: "" }),
      live({ position: 0 }),
      live({ position: "3" }),
      live({ updatedAt: "now" }),
      live({ extra: true }),
    ]) {
      await assertFails(bob().firestore().doc(sharePath(token)).update({ live: bad }))
    }
  })

  it("denies anonymous writers and members of other bands", async () => {
    const token = createId("share")
    await seedShare(token)
    await assertFails(guest().firestore().doc(sharePath(token)).update({ live: live() }))
    await assertFails(
      env.authenticatedContext("carol").firestore().doc(sharePath(token)).update({ live: live() }),
    )
  })

  it("serves an anonymous document listener — the fan page's live position", async () => {
    // The keystone of the feature: a single-document listener is served by
    // the `get` rule (not `list`, which stays closed) and keeps receiving the
    // band's writes while the page is open.
    const token = createId("share")
    await seedShare(token)
    const expected = live()
    const collector = new Promise<Record<string, unknown>>((resolve, reject) => {
      const unsubscribe = guest()
        .firestore()
        .doc(sharePath(token))
        .onSnapshot(
          (snapshot) => {
            const data = snapshot.data() as Record<string, unknown> | undefined
            if (data && "live" in data) {
              unsubscribe()
              resolve(data)
            }
          },
          (error) => {
            unsubscribe()
            reject(error)
          },
        )
    })
    await assertSucceeds(bob().firestore().doc(sharePath(token)).update({ live: expected }))
    const seen = await assertSucceeds(collector)
    expect(seen.live).toEqual(expected)
  })
})

describe("the live setlist pointer is member-writable (#57)", () => {
  const pathFor = (id: string) => `organizations/${orgId}/performances/${id}`
  const pointer = { token: "share-token-abc", setlistId: "setlist-1" }

  const seedShow = async (): Promise<string> => {
    const id = createId("show")
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(pathFor(id)).set({
        organizationId: orgId,
        name: "Sala Sur",
        date: "2026-10-17",
        setlists: [{ id: "setlist-1", name: "Main" }],
        venue: { name: "Sala Sur", address: "", notes: "" },
        status: "scheduled",
        type: "gig",
      })
    })
    return id
  }

  it("lets a member point the event at its live link — and detach it", async () => {
    const id = await seedShow()
    await assertSucceeds(
      bob().firestore().doc(pathFor(id)).update({ liveShare: pointer, updatedAt: new Date() }),
    )
    await assertSucceeds(
      bob().firestore().doc(pathFor(id)).update({ liveShare: null, updatedAt: new Date() }),
    )
  })

  it("lets an admin write it through the full-edit whitelist too", async () => {
    const id = await seedShow()
    await assertSucceeds(
      alice().firestore().doc(pathFor(id)).update({ liveShare: pointer, updatedAt: new Date() }),
    )
  })

  it("rejects a pointer outside the pinned shape", async () => {
    const id = await seedShow()
    for (const bad of [
      { token: "", setlistId: "setlist-1" },
      { token: "t" },
      { token: "t", setlistId: 5 },
    ]) {
      await assertFails(
        bob().firestore().doc(pathFor(id)).update({ liveShare: bad, updatedAt: new Date() }),
      )
    }
  })

  it("never lets the live pointer smuggle another field change", async () => {
    const id = await seedShow()
    await assertFails(
      bob()
        .firestore()
        .doc(pathFor(id))
        .update({ liveShare: pointer, name: "Renamed by a member", updatedAt: new Date() }),
    )
  })
})

describe("the guest role reads the band and nothing else (roadmap #59)", () => {
  /** A signed-in member whose document carries the read-only `guest` role. */
  const roger = () => env.authenticatedContext("roger")
  /** A fresh invitee whose invitation arrives with the guest role. */
  const ivan = () => env.authenticatedContext("ivan", { email: "ivan@example.com" })

  const seedGuest = async (): Promise<void> => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`organizations/${orgId}/members/roger`).set({
        uid: "roger",
        displayName: "roger",
        email: "roger@example.com",
        photoURL: "",
        role: "guest",
        joinedAt: new Date(),
        invitedBy: "alice",
      })
    })
  }

  /** One document of each surface the guest may (or may not) read. */
  const seedBandSurfaces = async (): Promise<void> => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await db.doc(`organizations/${orgId}/setlists/set-1`).set({
        organizationId: orgId,
        name: "Set",
        songs: [],
      })
      await db.doc(`organizations/${orgId}/performances/gig-1`).set({
        organizationId: orgId,
        name: "Gig",
        date: "2026-11-01",
      })
      await db
        .doc(`organizations/${orgId}/performances/gig-1/tasks/task-1`)
        .set({
          title: "PA",
          assignedTo: "",
          done: false,
          createdBy: "bob",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      await db.doc(`organizations/${orgId}/datePolls/poll-1`).set({
        organizationId: orgId,
        title: "When?",
        options: [],
        status: "open",
      })
      await db.doc(`organizations/${orgId}/checklists/check-1`).set({
        name: "Gear",
        kind: "gear",
        items: ["cables"],
      })
      await db.doc(`organizations/${orgId}/activity/evt-1`).set({ message: "Bob added a song" })
      await db.doc(`organizations/${orgId}/songs/${songId}/versions/v-1`).set({
        songId,
        title: "Before",
        sections: [],
      })
    })
  }

  it("lets a guest read the band's music and logistics", async () => {
    await seedGuest()
    await seedBandSurfaces()
    const db = roger().firestore()
    await assertSucceeds(db.doc(`organizations/${orgId}`).get())
    await assertSucceeds(db.doc(songPath()).get())
    await assertSucceeds(db.collection(`organizations/${orgId}/songs`).get())
    await assertSucceeds(db.doc(`organizations/${orgId}/setlists/set-1`).get())
    await assertSucceeds(db.doc(`organizations/${orgId}/performances/gig-1`).get())
    await assertSucceeds(db.collection(`organizations/${orgId}/performances/gig-1/tasks`).get())
    await assertSucceeds(db.collection(`organizations/${orgId}/members`).get())
  })

  it("keeps suggestions, the feed and the song history out of a guest's reach", async () => {
    await seedGuest()
    await seedBandSurfaces()
    const db = roger().firestore()
    await assertFails(db.doc(`organizations/${orgId}/suggestions/${suggestionId}`).get())
    await assertFails(db.collection(`organizations/${orgId}/suggestions`).get())
    await assertFails(db.doc(`organizations/${orgId}/activity/evt-1`).get())
    await assertFails(db.doc(`organizations/${orgId}/songs/${songId}/versions/v-1`).get())
  })

  it("keeps the date polls, the checklist library and the invitations out of reach", async () => {
    await seedGuest()
    await seedBandSurfaces()
    const db = roger().firestore()
    await assertFails(db.doc(`organizations/${orgId}/datePolls/poll-1`).get())
    await assertFails(db.doc(`organizations/${orgId}/checklists/check-1`).get())
    await assertFails(db.collection(`organizations/${orgId}/invitations`).get())
  })

  it("stops a guest writing the band's content", async () => {
    await seedGuest()
    const db = roger().firestore()
    await assertFails(
      db
        .doc(`organizations/${orgId}/songs/${createId("song")}`)
        .set({ organizationId: orgId, title: "Sneaky", sections: [] }),
    )
    await assertFails(db.doc(songPath()).update({ title: "Renamed by a guest" }))
    await assertFails(
      db
        .doc(`organizations/${orgId}/setlists/${createId("set")}`)
        .set({ organizationId: orgId, name: "Sneaky set", songs: [] }),
    )
  })

  it("stops a guest suggesting, commenting, assigning or resolving", async () => {
    await seedGuest()
    const db = roger().firestore()
    await assertFails(
      db
        .doc(`organizations/${orgId}/suggestions/${createId("suggestion")}`)
        .set(suggestion("roger")),
    )
    await assertFails(
      db
        .doc(`organizations/${orgId}/suggestions/${suggestionId}/comments/${createId("comment")}`)
        .set({
          body: "Nice one",
          authorId: "roger",
          authorName: "roger",
          createdAt: new Date(),
          deletedAt: null,
        }),
    )
    await assertFails(
      db.doc(`organizations/${orgId}/suggestions/${suggestionId}`).update({ assigneeId: "roger" }),
    )
    await assertFails(
      db.doc(`organizations/${orgId}/suggestions/${suggestionId}`).update({ status: "accepted" }),
    )
  })

  it("stops a guest answering the RSVP or ticking a task", async () => {
    await seedGuest()
    await seedBandSurfaces()
    const db = roger().firestore()
    await assertFails(
      db
        .doc(`organizations/${orgId}/performances/gig-1`)
        .update({ "attendance.roger": "yes", updatedAt: new Date() }),
    )
    await assertFails(
      db
        .doc(`organizations/${orgId}/performances/gig-1/tasks/task-1`)
        .update({ done: true, updatedAt: new Date() }),
    )
  })

  it("stops a guest writing the live setlist position", async () => {
    await seedGuest()
    const token = createId("share")
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`shares/${token}`).set({
        organizationId: orgId,
        kind: "song",
        songId,
        createdAt: new Date(),
        expiresAt: null,
      })
    })
    await assertFails(
      roger()
        .firestore()
        .doc(`shares/${token}`)
        .update({ live: { songId, position: 2, updatedAt: 1700000000000 } }),
    )
  })

  it("lets a guest keep their own reader state and stars", async () => {
    await seedGuest()
    const db = roger().firestore()
    await assertSucceeds(
      db.doc(`users/roger/readerState/${songId}`).set({
        autoscrollSpeed: 120,
        autoscrollDelay: 5,
        scrollRatio: 0.4,
        semitones: 0,
        capo: 0,
        fontSize: 18,
      }),
    )
    await assertSucceeds(db.doc(`users/roger/favorites/${songId}`).set({ songId }))
  })

  it("lets an admin make a member a guest — and take it back", async () => {
    await assertSucceeds(
      alice().firestore().doc(`organizations/${orgId}/members/bob`).update({ role: "guest" }),
    )
    await assertSucceeds(
      alice().firestore().doc(`organizations/${orgId}/members/bob`).update({ role: "member" }),
    )
  })

  it("never lets a guest change their own role", async () => {
    await seedGuest()
    await assertFails(
      roger().firestore().doc(`organizations/${orgId}/members/roger`).update({ role: "member" }),
    )
  })

  it("lets an admin invite a guest and nothing outside the roles", async () => {
    const invitation = (email: string, role: string) => ({
      organizationId: orgId,
      organizationName: "The band",
      email,
      role,
      status: "pending",
      invitedBy: "alice",
      invitedByName: "alice",
      createdAt: new Date(),
      respondedAt: null,
    })
    const email = `${createId("invitee")}@example.com`
    await assertSucceeds(
      alice()
        .firestore()
        .doc(`organizations/${orgId}/invitations/${email}`)
        .set(invitation(email, "guest")),
    )
    const bogus = `${createId("invitee")}@example.com`
    await assertFails(
      alice()
        .firestore()
        .doc(`organizations/${orgId}/invitations/${bogus}`)
        .set(invitation(bogus, "wizard")),
    )
  })

  it("lands a guest invitation as a guest on the member doc and the mirror", async () => {
    const email = "ivan@example.com"
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`organizations/${orgId}/invitations/${email}`).set({
        organizationId: orgId,
        organizationName: "The band",
        email,
        role: "guest",
        status: "pending",
        invitedBy: "alice",
        invitedByName: "alice",
        createdAt: new Date(),
        respondedAt: null,
      })
    })
    const ivansDb = ivan().firestore()
    const batch = ivansDb.batch()
    batch.update(ivansDb.doc(`organizations/${orgId}/invitations/${email}`), {
      status: "accepted",
      respondedAt: new Date(),
    })
    batch.set(ivansDb.doc(`organizations/${orgId}/members/ivan`), {
      uid: "ivan",
      displayName: "ivan",
      email,
      photoURL: "",
      role: "guest",
      joinedAt: new Date(),
      invitedBy: "alice",
    })
    batch.set(ivansDb.doc(`users/ivan/organizations/${orgId}`), {
      name: "The band",
      role: "guest",
      logoURL: "",
      joinedAt: new Date(),
    })
    await assertSucceeds(batch.commit())
    const mirror = await assertSucceeds(ivansDb.doc(`users/ivan/organizations/${orgId}`).get())
    expect(mirror.data()?.role).toBe("guest")
  })
})

describe("song edit presence is a soft heartbeat (roadmap #28)", () => {
  const roger = () => env.authenticatedContext("roger")
  const zed = () => env.authenticatedContext("zed")
  const dot = (uid: string, displayName = "The editor") => ({
    uid,
    displayName,
    updatedAt: new Date(),
  })
  const presencePath = (uid: string) => `${songPath()}/presence/${uid}`

  /** The roster fresh: earlier describes must not colour this one. */
  const seedRoster = async (): Promise<void> => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      const member = (uid: string, role: string, invitedBy: string) => ({
        uid,
        displayName: uid,
        email: `${uid}@example.com`,
        photoURL: "",
        role,
        joinedAt: new Date(),
        invitedBy,
      })
      await db.doc(`organizations/${orgId}/members/alice`).set(member("alice", "admin", ""))
      await db.doc(`organizations/${orgId}/members/bob`).set(member("bob", "member", "alice"))
      await db.doc(`organizations/${orgId}/members/roger`).set(member("roger", "guest", "alice"))
    })
  }

  beforeEach(seedRoster)

  it("lets the editor stamp and refresh their own dot", async () => {
    const db = alice().firestore()
    await assertSucceeds(db.doc(presencePath("alice")).set(dot("alice")))
    await assertSucceeds(db.doc(presencePath("alice")).set(dot("alice", "Alice the editor")))
  })

  it("never lets an editor claim somebody else's dot", async () => {
    const db = alice().firestore()
    // their name on somebody else's id
    await assertFails(db.doc(presencePath("bob")).set(dot("alice")))
    // somebody else's name on their own id
    await assertFails(db.doc(presencePath("alice")).set(dot("bob")))
  })

  it("rejects extra fields, oversized names and a clock that is not a timestamp", async () => {
    const db = alice().firestore()
    await assertFails(db.doc(presencePath("alice")).set({ ...dot("alice"), editing: true }))
    await assertFails(db.doc(presencePath("alice")).set(dot("alice", "x".repeat(81))))
    await assertFails(
      db.doc(presencePath("alice")).set({ uid: "alice", displayName: "Alice", updatedAt: "yesterday" }),
    )
  })

  it("shows the whole band who is inside and keeps outsiders out", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(presencePath("alice")).set(dot("alice"))
    })
    await assertSucceeds(bob().firestore().collection(`${songPath()}/presence`).get())
    await assertSucceeds(roger().firestore().collection(`${songPath()}/presence`).get())
    await assertFails(zed().firestore().collection(`${songPath()}/presence`).get())
    await assertFails(guest().firestore().collection(`${songPath()}/presence`).get())
  })

  it("keeps guests out of the dot", async () => {
    await assertFails(roger().firestore().doc(presencePath("roger")).set(dot("roger")))
  })

  it("lets the editor retire their own dot and an admin sweep one, but no other member", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await db.doc(presencePath("alice")).set(dot("alice"))
      await db.doc(presencePath("bob")).set(dot("bob"))
    })
    await assertFails(bob().firestore().doc(presencePath("alice")).delete())
    await assertSucceeds(alice().firestore().doc(presencePath("alice")).delete())
    await assertSucceeds(alice().firestore().doc(presencePath("bob")).delete())
  })
})
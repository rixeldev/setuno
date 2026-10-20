/**
 * The Cloud Storage rules (`storage.rules`, the contract of
 * `services/uploads.ts` and `services/songAttachments.ts`) against the
 * emulator: the caller's own folder, real images under 10 MB, and PDF song
 * attachments under the uploader's uid segment (roadmap #40). Same run flow
 * as `firestoreRules.test.ts`.
 *
 * Only writes are asserted: a download of a missing object rejects whether the
 * rules allowed it or not, so without a seeded file a read assertion could pass
 * for the wrong reason — the delete cases below seed their object first for
 * exactly that reason.
 */
import { readFileSync } from "node:fs"

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing"
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest"

let env: RulesTestEnvironment

/** The tiniest possible JPEG payload — the rules only see size + type. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])

/** Starts an upload as `uid` and turns the task into a plain promise. */
const upload = (uid: string, path: string, data: Uint8Array, contentType: string) =>
  env
    .authenticatedContext(uid)
    .storage()
    .ref(path)
    .put(data, { contentType })
    .then(() => null)

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-setuno-storage",
    storage: { rules: readFileSync("storage.rules", "utf8") },
  })
})

afterAll(() => env.cleanup())

beforeEach(() => env.clearStorage())

describe("storage writes are the uploader's own images", () => {
  it("accepts an image in the caller's avatar folder", async () => {
    await assertSucceeds(upload("alice", "avatars/alice/pic.jpg", JPEG, "image/jpeg"))
  })

  it("accepts an image in the caller's organization folder", async () => {
    await assertSucceeds(upload("alice", "organizations/alice/logo.png", JPEG, "image/png"))
  })

  it("denies writing into somebody else's folder", async () => {
    await assertFails(upload("alice", "avatars/bob/pic.jpg", JPEG, "image/jpeg"))
    await assertFails(upload("alice", "organizations/bob/logo.png", JPEG, "image/png"))
  })

  it("denies anything that is not an image", async () => {
    await assertFails(upload("alice", "avatars/alice/clip.mp3", JPEG, "audio/mpeg"))
  })

  it("denies files of 10 MB or more", async () => {
    const oversized = new Uint8Array(11 * 1024 * 1024)
    await assertFails(upload("alice", "avatars/alice/huge.jpg", oversized, "image/jpeg"))
  })

  it("denies signed-out uploads", async () => {
    await assertFails(
      env
        .unauthenticatedContext()
        .storage()
        .ref("avatars/alice/pic.jpg")
        .put(JPEG, { contentType: "image/jpeg" })
        .then(() => null),
    )
  })
})

describe("song attachments are signed-in PDFs under the uploader (#40)", () => {
  /** Bytes that spell %PDF — the rules only see size + contentType anyway. */
  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])

  const attachmentPath = (uid: string, fileName = "att_1.pdf") =>
    `organizations/org1/songs/song1/attachments/${uid}/${fileName}`

  it("accepts a PDF in the caller's attachment folder", async () => {
    await assertSucceeds(upload("alice", attachmentPath("alice"), PDF, "application/pdf"))
  })

  it("denies writing into another user's attachment segment", async () => {
    await assertFails(upload("alice", attachmentPath("bob"), PDF, "application/pdf"))
  })

  it("denies anything that is not a PDF on an attachment path", async () => {
    await assertFails(upload("alice", attachmentPath("alice"), PDF, "image/jpeg"))
    await assertFails(upload("alice", attachmentPath("alice"), PDF, "text/plain"))
  })

  it("denies attachment files of 10 MB or more", async () => {
    const oversized = new Uint8Array(11 * 1024 * 1024)
    await assertFails(upload("alice", attachmentPath("alice"), oversized, "application/pdf"))
  })

  it("denies signed-out attachment uploads", async () => {
    await assertFails(
      env
        .unauthenticatedContext()
        .storage()
        .ref(attachmentPath("alice"))
        .put(PDF, { contentType: "application/pdf" })
        .then(() => null),
    )
  })

  it("lets the uploader delete their own attachment", async () => {
    await assertSucceeds(upload("alice", attachmentPath("alice"), PDF, "application/pdf"))
    await assertSucceeds(
      env.authenticatedContext("alice").storage().ref(attachmentPath("alice")).delete(),
    )
  })

  it("denies deleting somebody else's attachment", async () => {
    await assertSucceeds(upload("alice", attachmentPath("alice"), PDF, "application/pdf"))
    await assertFails(
      env.authenticatedContext("bob").storage().ref(attachmentPath("alice")).delete(),
    )
  })
})

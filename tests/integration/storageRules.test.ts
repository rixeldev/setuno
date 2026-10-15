/**
 * The Cloud Storage rules (`storage.rules`, the contract of
 * `services/uploads.ts`) against the emulator: the caller's own folder, real
 * images, under 10 MB. Same run flow as `firestoreRules.test.ts`.
 *
 * Only writes are asserted: a download of a missing object rejects whether the
 * rules allowed it or not, so without a seeded file a read assertion could pass
 * for the wrong reason.
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

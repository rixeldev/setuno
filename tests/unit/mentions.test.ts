import { describe, expect, it } from "vitest"

import {
  appendMention,
  extractMentionUids,
  splitMentions,
  type MentionMember,
} from "../../functions/src/mentions"

/**
 * The `@mention` parser (roadmap #58) — shared verbatim by the comment
 * composer, the comment renderer and the push trigger, so these cases are
 * the contract all three run on.
 */
const roster: MentionMember[] = [
  { uid: "u-ann", displayName: "Ann" },
  { uid: "u-ann-lee", displayName: "Ann Lee" },
  { uid: "u-bob", displayName: "Bob" },
  { uid: "u-jose", displayName: "José" },
]

const uids = (body: string, members: readonly MentionMember[] = roster) =>
  extractMentionUids(body, members)

describe("extractMentionUids", () => {
  it("resolves a handle against the roster", () => {
    expect(uids("@Bob can you check the bridge?")).toEqual(["u-bob"])
  })

  it("matches case-insensitively", () => {
    expect(uids("@bob is on guitar")).toEqual(["u-bob"])
    expect(uids("@BOB is on guitar")).toEqual(["u-bob"])
  })

  it("prefers the longest roster name", () => {
    expect(uids("@Ann Lee is singing")).toEqual(["u-ann-lee"])
    expect(uids("@Ann is on guitar")).toEqual(["u-ann"])
  })

  it("never glues a handle to a longer word", () => {
    expect(uids("@Annabelle plays keyboards")).toEqual([])
    expect(uids("@Bobby is late")).toEqual([])
  })

  it("never treats an email address as a mention", () => {
    expect(uids("mail bob@example.com about it")).toEqual([])
  })

  it("accepts the punctuation a sentence puts after a handle", () => {
    expect(uids("@José, ¿lo ves?")).toEqual(["u-jose"])
    expect(uids("thanks @Ann Lee!")).toEqual(["u-ann-lee"])
    expect(uids("@Ann Lee's part is early")).toEqual(["u-ann-lee"])
  })

  it("dedupes a repeated handle and keeps first-appearance order", () => {
    expect(uids("@Bob @Ann and @Bob again")).toEqual(["u-bob", "u-ann"])
  })

  it("collects several mentions from one comment", () => {
    expect(uids("@Ann and @José rehearsed it")).toEqual(["u-ann", "u-jose"])
  })

  it("leaves unknown handles as plain text", () => {
    expect(uids("@Zed says hi")).toEqual([])
    expect(uids("a bare @ sign")).toEqual([])
  })

  it("does not match across collapsed whitespace the stored name never has", () => {
    expect(uids("@Ann  Lee is singing")).toEqual(["u-ann"])
  })

  it("resolves nothing against an empty roster", () => {
    expect(uids("@Bob says hi", [])).toEqual([])
  })

  it("skips a member with no display name", () => {
    expect(uids("@Bob says hi", [{ uid: "u-x", displayName: "" }])).toEqual([])
  })
})

describe("splitMentions", () => {
  it("reconstructs the original body exactly", () => {
    const body = "hey @Ann Lee and @Bob — see @Zed's note at bob@example.com"
    expect(splitMentions(body, roster).map((segment) => segment.text).join("")).toBe(body)
  })

  it("tags only the handles that resolve", () => {
    const segments = splitMentions("hey @Ann Lee and @Zed", roster)
    expect(segments).toEqual([
      { text: "hey ", uid: null },
      { text: "@Ann Lee", uid: "u-ann-lee" },
      { text: " and @Zed", uid: null },
    ])
  })

  it("merges neighbouring plain runs into one segment", () => {
    expect(splitMentions("no mentions here", roster)).toEqual([
      { text: "no mentions here", uid: null },
    ])
  })
})

describe("appendMention", () => {
  it("starts a mention from an empty draft", () => {
    expect(appendMention("", "Bob")).toBe("@Bob ")
  })

  it("adds the space the previous word needs", () => {
    expect(appendMention("check this", "Bob")).toBe("check this @Bob ")
  })

  it("does not double the trailing space", () => {
    expect(appendMention("check this ", "Bob")).toBe("check this @Bob ")
    expect(appendMention("check this\n", "Bob")).toBe("check this\n@Bob ")
  })
})

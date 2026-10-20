import { describe, expect, it } from "vitest"

import { redirectSystemPath } from "../../app/+native-intent"
import {
  EMAIL_LINK_ROUTE,
  emailLinkContinueUrl,
  isAuthLinkUrl,
} from "../../libs/emailLink"

/**
 * Email-link sign-in (roadmap #67): which incoming URLs the app claims as its
 * own — that decision is what makes a phone open the sign-in instead of a
 * browser — and where the one-time code is handed back when no app answers.
 */

const HOST_LINK = "https://setuno-be01d.firebaseapp.com/__/auth/links"
const QUERY = "?dld=1&oobCode=abc123&mode=signIn&apiKey=AIza…&continueUrl=https%3A%2F%2Fsetuno.vercel.app%2Femail-link&lang=en"

describe("isAuthLinkUrl", () => {
  it("claims the Firebase Hosting sign-in handler", () => {
    expect(isAuthLinkUrl(`${HOST_LINK}${QUERY}`)).toBe(true)
  })

  it("claims the older action path and the web.app host too", () => {
    expect(isAuthLinkUrl("https://setuno-be01d.web.app/__/auth/action?oobCode=x&mode=signIn")).toBe(
      true,
    )
  })

  it("claims the path even when only the path is handed over", () => {
    // Expo Router may pass a system path without its origin.
    expect(isAuthLinkUrl(`/__/auth/links?oobCode=x&mode=signIn`)).toBe(true)
  })

  it("leaves every other route alone", () => {
    expect(isAuthLinkUrl("https://setuno.vercel.app/email-link?oobCode=x")).toBe(false)
    expect(isAuthLinkUrl("https://setuno.vercel.app/songs/abc123")).toBe(false)
    expect(isAuthLinkUrl("/share/tok-123")).toBe(false)
  })

  it("rejects a look-alike host", () => {
    expect(isAuthLinkUrl(`https://setuno-be01d.firebaseapp.com.evil.example/__/auth/links`)).toBe(
      false,
    )
    expect(isAuthLinkUrl(`https://evilfirebaseapp.com/__/auth/links`)).toBe(false)
    expect(isAuthLinkUrl(`https://evil.example.com/__/auth/links`)).toBe(false)
  })

  it("rejects plain http and anything unparseable", () => {
    expect(isAuthLinkUrl(`http://setuno-be01d.firebaseapp.com/__/auth/links`)).toBe(false)
    expect(isAuthLinkUrl("")).toBe(false)
    expect(isAuthLinkUrl(" ::not a url")).toBe(false)
    expect(isAuthLinkUrl("setuno-be01d.firebaseapp.com/__/auth/links")).toBe(false)
  })
})

describe("emailLinkContinueUrl", () => {
  it("points the browser at the app's own completion route", () => {
    expect(emailLinkContinueUrl("https://setuno.vercel.app", "setuno-be01d.firebaseapp.com")).toBe(
      "https://setuno.vercel.app/email-link",
    )
  })

  it("tolerates trailing slashes on the origin", () => {
    expect(emailLinkContinueUrl("https://setuno.app///", "setuno-be01d.firebaseapp.com")).toBe(
      "https://setuno.app/email-link",
    )
  })

  it("falls back to the authorized authDomain when there is no web address", () => {
    expect(emailLinkContinueUrl(null, "setuno-be01d.firebaseapp.com")).toBe(
      "https://setuno-be01d.firebaseapp.com/email-link",
    )
  })
})

describe("redirectSystemPath", () => {
  it("rewrites an arriving auth link onto the completion route", () => {
    expect(redirectSystemPath({ path: `${HOST_LINK}${QUERY}`, initial: true })).toBe(
      EMAIL_LINK_ROUTE,
    )
  })

  it("never touches another system path", () => {
    const path = "https://setuno.vercel.app/songs/abc123"
    expect(redirectSystemPath({ path, initial: false })).toBe(path)
    expect(redirectSystemPath({ path: "setuno://open", initial: false })).toBe("setuno://open")
  })
})

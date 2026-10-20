import { EMAIL_LINK_ROUTE, isAuthLinkUrl } from "@/libs/emailLink"

/**
 * Native deep-link interception (roadmap #67).
 *
 * A phone that installed the app opens the Firebase Hosting sign-in link
 * (`PROJECT_ID.firebaseapp.com/__/auth/links?…`) directly, as an Android App
 * Link — a URL Expo Router has no route for. This hook (SDK 51+'s
 * `+native-intent`, called before the router resolves an incoming system path)
 * rewrites exactly that URL onto the completion route and leaves every other
 * system path untouched.
 *
 * The raw link is *not* passed along: `expo-linking` keeps reporting it, so the
 * route reads it itself — which is also what lets a warm start (the app already
 * running) reach the same place as a cold one.
 *
 * Not a screen: Expo Router excludes `+native-intent` from the route tree, so
 * it exports the handler, never a component.
 */
export function redirectSystemPath(event: { path: string; initial: boolean }): string {
  try {
    return isAuthLinkUrl(event.path) ? EMAIL_LINK_ROUTE : event.path
  } catch {
    // The docs are explicit: a throw here can crash the app. Anything this
    // cannot parse is somebody else's link — hand it back untouched.
    return event.path
  }
}

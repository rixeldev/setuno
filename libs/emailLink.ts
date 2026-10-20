/**
 * Email-link (passwordless) sign-in helpers (roadmap #67). Pure — no React
 * Native imports, so `+native-intent`, the completion route and the unit suite
 * all share one tested decision.
 *
 * Firebase no longer uses Dynamic Links: the email points at the Hosting auth
 * handler (`PROJECT_ID.firebaseapp.com/__/auth/links`, or the older
 * `__/auth/action` path), and a device with the app installed opens it through
 * Android App Links — the `assetlinks.json` Firebase serves on that host once
 * the project's SHA fingerprints are registered. Everywhere else (a desktop
 * browser, or a phone without the app) the same URL is a normal page that
 * hands the one-time code to the *continue URL*, which is where the web build
 * finishes the sign-in.
 */

/** The in-app route that both the send form and the completion land on. */
export const EMAIL_LINK_ROUTE = "/email-link"

/** Firebase Hosting serves the sign-in link under these two handler paths. */
const AUTH_LINK_PATHS = ["/__/auth/links", "/__/auth/action"]

/** Firebase's own Hosting auth hosts — the only ones this app should claim. */
const AUTH_LINK_HOST_SUFFIXES = [".firebaseapp.com", ".web.app"]

/**
 * True when a URL is the Firebase auth link handler rather than one of our own
 * routes. The path is what makes it unambiguous (`__/auth/links` never collides
 * with an app route) and the host suffix keeps a look-alike domain out. This
 * only decides whether `+native-intent` should intercept; the route behind it
 * still verifies the one-time code with the SDK.
 */
export const isAuthLinkUrl = (url: string): boolean => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    // Expo may hand the router a bare path instead of an absolute URL; there
    // is then no host to check, but the path alone is still unambiguous (only
    // Firebase Hosting ever serves `__/auth/…`, and the intent filter in
    // `app.config.js` pins the host anyway).
    try {
      parsed = new URL(url, "https://placeholder.invalid")
    } catch {
      return false
    }
    return AUTH_LINK_PATHS.some((candidate) => parsed.pathname.startsWith(candidate))
  }
  if (parsed.protocol !== "https:") return false
  const host = parsed.hostname.toLowerCase()
  if (!AUTH_LINK_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false
  return AUTH_LINK_PATHS.some((candidate) => parsed.pathname.startsWith(candidate))
}

/**
 * Where the browser is handed the code after the click: the app's own
 * email-link route, so a click on a desktop — or on a phone without the app —
 * still lands inside Setuno and finishes there instead of on Firebase's
 * default page. With no live web origin the authDomain stands in; it is a
 * Firebase-authorized domain by construction, so `sendSignInLinkToEmail`
 * accepts it out of the box, and setting `EXPO_PUBLIC_WEB_BASE_URL` upgrades
 * the fallback to the real deployment without a code change.
 */
export const emailLinkContinueUrl = (webOrigin: string | null, authDomain: string): string => {
  const base = webOrigin ? webOrigin.replace(/\/+$/, "") : `https://${authDomain}`
  return `${base}${EMAIL_LINK_ROUTE}`
}

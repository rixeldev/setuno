/**
 * Web shim (roadmap #72): browser attestation needs a reCAPTCHA Enterprise
 * site key registered in the Firebase console, and the web build has none —
 * so it sends no App Check token on purpose, and enforcement must stay in
 * monitor mode until web is enrolled. Metro resolves this file for platform=web.
 */
export const startAppCheck = (): void => undefined

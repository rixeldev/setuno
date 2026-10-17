/**
 * Share link URL (roadmap #56). Pure — no React Native imports, so it unit
 * tests in node.
 *
 * The origin comes from the live browser when there is one (every deployment,
 * preview or custom domain is then automatically correct) and from
 * `EXPO_PUBLIC_WEB_BASE_URL` everywhere else, where no page is hosting the
 * app — the public web address of the deployment, baked in at build time. A
 * runtime with neither has no link to hand out, and the share sheet says so
 * instead of printing a broken URL.
 */

/** Absolute URL of one share: `<base>/share/<token>`. */
export const buildShareUrl = (baseUrl: string, token: string): string =>
  `${baseUrl.replace(/\/+$/, "")}/share/${encodeURIComponent(token)}`

/**
 * Browser origin, else the configured web base, else `null`.
 * Read structurally off `globalThis`: native runtimes have no `location`, and
 * this file must typecheck without DOM lib types.
 */
export const resolveShareBaseUrl = (): string | null => {
  const page = globalThis as unknown as { location?: { origin?: unknown } }
  const origin = typeof page.location?.origin === "string" ? page.location.origin : null
  if (origin && origin.startsWith("http")) return origin
  const configured = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim()
  return configured && configured.startsWith("http") ? configured : null
}

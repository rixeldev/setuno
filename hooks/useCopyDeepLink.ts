import { useCallback } from "react"
import * as Clipboard from "expo-clipboard"
import { useTranslation } from "react-i18next"

import { useToast } from "@/components/ui/Toast"
import { buildSetlistLink, buildSongLink } from "@/libs/deepLinks"
// The share links' origin resolver is really a "browser origin, else
// `EXPO_PUBLIC_WEB_BASE_URL`, else null" helper wearing a share-shaped name —
// the same question this flow asks, so the seam is reused rather than copied.
import { resolveShareBaseUrl as resolveWebOrigin } from "@/libs/shareLink"

/** What a deep link can point at. */
export type DeepLinkKind = "song" | "setlist"

/**
 * Copies the public link of a song or a setlist (roadmap #76).
 *
 * The link is the app's **own** web address plus the public shape
 * (`/song/<id>`, `/setlist/<id>`): tapping it opens the app when it is
 * installed and the web app when it is not, and it only ever points at
 * something inside the band — the public snapshot is a different thing, and
 * the share sheet mints that one.
 *
 * A build with no web address configured cannot produce a link at all, and
 * says so instead of copying a broken one.
 */
export const useCopyDeepLink = () => {
  const { t } = useTranslation()
  const toast = useToast()

  return useCallback(
    async (kind: DeepLinkKind, id: string, title: string): Promise<void> => {
      const base = resolveWebOrigin()
      if (!base) {
        toast.showError(t("deepLinks.notConfigured"))
        return
      }
      const url = kind === "song" ? buildSongLink(base, id) : buildSetlistLink(base, id)
      await Clipboard.setStringAsync(url)
      toast.showSuccess(t("deepLinks.copied", { title }))
    },
    [t, toast],
  )
}

import React from "react"
import { Linking, Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import {
  AppleMusicIcon,
  OpenExternalIcon,
  SpotifyIcon,
  YouTubeIcon,
} from "@/components/ui/Icons"
import { songLinkEntries } from "@/libs/songLinks"
import type { SongLinkProvider, SongLinks as SongLinksValue } from "@/interfaces"

interface SongLinksProps {
  links: SongLinksValue | null | undefined
}

const ICONS: Record<SongLinkProvider, (props: { size?: number; color?: string }) => React.ReactNode> = {
  youtube: YouTubeIcon,
  spotify: SpotifyIcon,
  appleMusic: AppleMusicIcon,
}

const LABEL_KEYS: Record<SongLinkProvider, string> = {
  youtube: "songs.linkYoutube",
  spotify: "songs.linkSpotify",
  appleMusic: "songs.linkAppleMusic",
}

/**
 * The song's external references (roadmap #16): one button per provider that
 * opens the link in the platform browser/app. Nothing is embedded, so no
 * service terms are bent — the reader just hands off to the right app.
 *
 * Kept deliberately small: these are references, not the song. The row sits
 * under the lyrics as a segmented strip, so three services take one line of a
 * phone instead of three full-width buttons competing with the music.
 */
export function SongLinks({ links }: SongLinksProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const entries = songLinkEntries(links)

  if (entries.length === 0) return null

  return (
    <View style={styles.row}>
      {entries.map(({ provider, url }) => {
        const Icon = ICONS[provider]
        const label = t(LABEL_KEYS[provider])
        return (
          <Pressable
            key={provider}
            accessibilityRole="link"
            accessibilityLabel={t("songs.openSongLinkA11y", { service: label })}
            onPress={() => void Linking.openURL(url).catch(() => undefined)}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <Icon size={13} color={Theme.colors.accent} />
            <AppText variant="caption" tone="accent" numberOfLines={1}>
              {label}
            </AppText>
            <OpenExternalIcon size={11} color={Theme.colors.textFaint} />
          </Pressable>
        )
      })}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Theme.radii.pill,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.surface,
    },
    pressed: { opacity: 0.7 },
  })

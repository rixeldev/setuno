import React, { useCallback, useState } from "react"
import { Image, Pressable, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { AppBackground } from "@/components/app/AppBackground"
import { OnboardingCarousel } from "@/components/onboarding/OnboardingCarousel"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useResponsive } from "@/hooks/useResponsive"
import { seedDemoSongOnce } from "@/services/demoSong"
import { DEMO_SONG_ID } from "@/libs/demoSong"

/**
 * First-run welcome and guided-tour entry point (roadmap #65).
 *
 * Shown once, right after a brand-new account gets its band. Finishing or
 * skipping stamps `onboarded` on the profile, which is what keeps the screen
 * away on every later start — and for accounts that predate the feature.
 * The shell hides its navigation here, so onboarding owns the whole screen.
 */
export default function Onboarding() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { gutter } = useResponsive()
  const { profile, updateProfile } = useAuth()
  const { organizationId, isAdmin } = useOrganization()
  const [busy, setBusy] = useState(false)

  const finish = useCallback(
    (destination: string): void => {
      // Fire-and-forget: the local profile cache is updated first, so the flag
      // sticks even when the device is offline right now.
      void updateProfile({ onboarded: true }).catch(() => undefined)
      router.replace(destination)
    },
    [router, updateProfile],
  )

  // The guided tour opens the sample song in the reader, so the playground has
  // to exist first. Only an admin can publish it, and the one-shot flag keeps
  // it from ever coming back after a deletion.
  const startTour = useCallback(async (): Promise<void> => {
    setBusy(true)
    try {
      if (organizationId && profile?.uid) {
        await seedDemoSongOnce({
          organizationId,
          uid: profile.uid,
          authorName: profile.displayName || "Setuno",
          alreadySeeded: profile?.preferences?.demoSongSeeded === true,
        })
      }
    } catch {
      // The sample song is a nice-to-have: never block onboarding on it.
    } finally {
      setBusy(false)
    }
    finish(`/songs/${DEMO_SONG_ID}?tour=reader`)
  }, [finish, organizationId, profile])

  const canTour = isAdmin && Boolean(organizationId)

  return (
    <View style={styles.host}>
      <AppBackground />

      <View
        style={[
          styles.header,
          { paddingTop: insets.top + Theme.spacing.m, paddingHorizontal: gutter },
        ]}
      >
        <View style={styles.brand}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.logo}
            accessibilityIgnoresInvertColors
          />
          <AppText variant="subheading">Setuno</AppText>
        </View>
        <Pressable
          onPress={() => finish("/")}
          hitSlop={Theme.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={t("onboarding.skip")}
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
        >
          <AppText variant="caption" tone="muted">
            {t("onboarding.skip")}
          </AppText>
        </Pressable>
      </View>

      <OnboardingCarousel
        finishLabel={canTour ? t("onboarding.startTour") : t("onboarding.exploreOnMyOwn")}
        onFinish={canTour ? () => void startTour() : () => finish("/")}
        busy={busy}
      />

      <View style={{ height: insets.bottom + Theme.spacing.m }} />
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.m,
      paddingBottom: Theme.spacing.m,
    },
    brand: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    logo: { width: 34, height: 34, borderRadius: Theme.radii.m },
    skip: {
      paddingVertical: Theme.spacing.xs,
      paddingHorizontal: Theme.spacing.s,
      borderRadius: Theme.radii.s,
      backgroundColor: Theme.colors.surfaceHigh,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
    },
    pressed: { opacity: 0.7 },
  })

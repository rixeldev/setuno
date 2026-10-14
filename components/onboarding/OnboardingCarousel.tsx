import React, { useRef, useState } from "react"
import { StyleSheet, View, type ViewStyle } from "react-native"
import AppIntroSlider from "react-native-app-intro-slider"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Button } from "@/components/ui/Button"
import { CalendarIcon, FullscreenIcon, GuitarIcon, MusicIcon } from "@/components/ui/Icons"
import { ONBOARDING_SLIDES, type OnboardingIconId, type OnboardingSlideCopy } from "@/libs/onboarding"

/** Illustration per slide id; the `Record` keeps the pairs exhaustive. */
const SLIDE_ICONS: Record<
  OnboardingIconId,
  React.ComponentType<{ size?: number; color?: string }>
> = {
  songbook: MusicIcon,
  chords: GuitarIcon,
  stage: FullscreenIcon,
  gigs: CalendarIcon,
}

/**
 * Dot styles `react-native-app-intro-slider` requires as props. They are unused
 * because this component renders its own pagination (the library's built-in one
 * wraps itself in the deprecated `SafeAreaView`).
 */
const UNUSED_DOT: ViewStyle = { width: 0, height: 0 }

interface OnboardingCarouselProps {
  /** Label of the primary button on the last slide. */
  finishLabel: string
  onFinish: () => void
  busy?: boolean
}

/**
 * Swipeable welcome slides plus the primary call to action (roadmap #65).
 * The screen owns the header and the navigation; this is pure presentation.
 */
export function OnboardingCarousel({
  finishLabel,
  onFinish,
  busy = false,
}: OnboardingCarouselProps) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const slider = useRef<AppIntroSlider<OnboardingSlideCopy>>(null)
  const [index, setIndex] = useState(0)
  const last = ONBOARDING_SLIDES.length - 1

  const goNext = (): void => {
    const target = Math.min(index + 1, last)
    // Move our own index first and tell the slider not to report the change
    // back, so a quick double tap cannot skip a slide.
    setIndex(target)
    slider.current?.goToSlide(target, false)
  }

  return (
    <View style={styles.host}>
      <View style={styles.slider}>
        <AppIntroSlider<OnboardingSlideCopy>
          ref={slider}
          data={ONBOARDING_SLIDES}
          renderItem={({ item }) => {
            const Icon = SLIDE_ICONS[item.icon]
            return (
              <View style={styles.slide}>
                <View style={styles.slideIcon}>
                  <Icon size={30} color={Theme.colors.primary} />
                </View>
                <AppText variant="heading" style={styles.centered}>
                  {t(item.titleKey)}
                </AppText>
                <AppText variant="body" tone="muted" style={styles.centered}>
                  {t(item.bodyKey)}
                </AppText>
              </View>
            )
          }}
          renderPagination={(active) => (
            <View style={styles.dots}>
              {ONBOARDING_SLIDES.map((slide, dotIndex) => (
                <View
                  key={slide.titleKey}
                  style={[styles.dot, dotIndex === active && styles.dotActive]}
                />
              ))}
            </View>
          )}
          onSlideChange={setIndex}
          activeDotStyle={UNUSED_DOT}
          dotStyle={UNUSED_DOT}
          dotClickEnabled={false}
          skipLabel=""
          doneLabel=""
          nextLabel=""
          prevLabel=""
          showDoneButton={false}
          showNextButton={false}
          showPrevButton={false}
          showSkipButton={false}
          bottomButton={false}
        />
      </View>

      <View style={styles.actions}>
        <Button
          label={index === last ? finishLabel : t("onboarding.next")}
          full
          size="lg"
          loading={busy}
          onPress={index === last ? onFinish : goNext}
        />
      </View>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1, gap: Theme.spacing.l },
    slider: { flex: 1 },
    slide: {
      flex: 1,
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
      gap: Theme.spacing.m,
      paddingHorizontal: Theme.spacing.l,
    },
    slideIcon: {
      width: 68,
      height: 68,
      borderRadius: Theme.radii.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      marginBottom: Theme.spacing.xs,
    },
    centered: { textAlign: "center" },
    dots: { flexDirection: "row", justifyContent: "center", gap: Theme.spacing.xs },
    dot: {
      width: 7,
      height: 7,
      borderRadius: Theme.radii.pill,
      backgroundColor: Theme.colors.surfaceMuted,
    },
    dotActive: { width: 20, backgroundColor: Theme.colors.primary },
    actions: { gap: Theme.spacing.s, paddingHorizontal: Theme.spacing.l },
  })

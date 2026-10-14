/**
 * Copy for the guided onboarding (roadmap #65).
 *
 * Only i18n keys live here — no React or React Native imports — so the unit
 * tests can check that every key really exists in both locale bundles. The
 * screens resolve them with `t(key)`.
 */

/** Which illustration a slide uses; mapped to a real icon by the carousel. */
export type OnboardingIconId = "songbook" | "chords" | "stage" | "gigs"

export interface OnboardingSlideCopy {
  /** Illustration id; `components/onboarding/OnboardingCarousel.tsx` maps it. */
  icon: OnboardingIconId
  titleKey: string
  bodyKey: string
}

/** The short welcome, in order (three to four slides). */
export const ONBOARDING_SLIDES: OnboardingSlideCopy[] = [
  {
    icon: "songbook",
    titleKey: "onboarding.slideSongbookTitle",
    bodyKey: "onboarding.slideSongbookBody",
  },
  {
    icon: "chords",
    titleKey: "onboarding.slideChordsTitle",
    bodyKey: "onboarding.slideChordsBody",
  },
  {
    icon: "stage",
    titleKey: "onboarding.slideStageTitle",
    bodyKey: "onboarding.slideStageBody",
  },
  {
    icon: "gigs",
    titleKey: "onboarding.slideGigsTitle",
    bodyKey: "onboarding.slideGigsBody",
  },
]

export interface TourStepCopy {
  titleKey: string
  bodyKey: string
}

/** Contextual tips shown inside the song reader. */
export const READER_TOUR: TourStepCopy[] = [
  { titleKey: "onboarding.tourReaderTapTitle", bodyKey: "onboarding.tourReaderTapBody" },
  {
    titleKey: "onboarding.tourReaderControlsTitle",
    bodyKey: "onboarding.tourReaderControlsBody",
  },
  {
    titleKey: "onboarding.tourReaderScrollTitle",
    bodyKey: "onboarding.tourReaderScrollBody",
  },
  { titleKey: "onboarding.tourReaderStageTitle", bodyKey: "onboarding.tourReaderStageBody" },
]

/** Contextual tips shown inside the chord/lyric editor. */
export const EDITOR_TOUR: TourStepCopy[] = [
  { titleKey: "onboarding.tourEditorPlaceTitle", bodyKey: "onboarding.tourEditorPlaceBody" },
  {
    titleKey: "onboarding.tourEditorSectionsTitle",
    bodyKey: "onboarding.tourEditorSectionsBody",
  },
  { titleKey: "onboarding.tourEditorSaveTitle", bodyKey: "onboarding.tourEditorSaveBody" },
]

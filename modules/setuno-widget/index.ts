import { requireOptionalNativeModule } from "expo-modules-core"

/**
 * Setuno's Android home-screen widget (roadmap #78).
 *
 * The widget is a **local Expo module**: it lives in `modules/setuno-widget`
 * and is autolinked through `expo.autolinking.nativeModulesDir` (the
 * `modules/` directory the roadmap pointed at).
 *
 * The app never builds the widget's own texts — it sends an already
 * localized payload, and the module stores it and redraws the widget. That
 * keeps the widget in the band's language without shipping the app's
 * translations to the launcher.
 */

/** What the widget shows. Every string is already localized by the app. */
export interface HomeWidgetPayload {
  /** The band's name — the widget's header. */
  bandName: string
  /** The headline: the next gig's name, or a line saying there is none. */
  title: string
  /** The second line: when it is, and where. */
  subtitle: string
  /** The third line: the setlist the band will play, if any. */
  detail: string
  /** The in-app route the widget opens ("performances/<id>"). */
  route: string
}

interface SetunoWidgetNativeModule {
  updateWidget(payload: HomeWidgetPayload): void
}

/**
 * The native module, or `null` where there is none — the web build has no
 * home screen to decorate, and the module simply is not there.
 */
const native = requireOptionalNativeModule<SetunoWidgetNativeModule>("SetunoWidget")

/** True where the widget can actually be shown. */
export const isHomeWidgetAvailable = native !== null

/**
 * Publishes the widget's content, or clears it.
 *
 * Fire-and-forget: a widget that cannot be updated is not worth an error
 * message, and the app keeps working exactly the same.
 */
export const publishHomeWidget = (payload: HomeWidgetPayload | null): void => {
  if (!native) return
  try {
    native.updateWidget(
      payload ?? {
        bandName: "",
        title: "",
        subtitle: "",
        detail: "",
        route: "",
      },
    )
  } catch {
    // A widget that refuses the payload is not the app's problem.
  }
}

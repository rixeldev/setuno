import {
  isHomeWidgetAvailable,
  publishHomeWidget,
  type HomeWidgetPayload,
} from "@/modules/setuno-widget"

/**
 * The Android home-screen widget (roadmap #78).
 *
 * This service is the **only** place that touches the native module: the
 * module is a local Expo module (`modules/setuno-widget`) and it simply does
 * not exist on the web, so the calls are no-ops there.
 *
 * The content is pushed rather than pulled: the widget cannot read Firestore
 * (nor should it), so the app hands it what it already knows.
 */

export type { HomeWidgetPayload }

/** True where a home-screen widget can be shown. */
export { isHomeWidgetAvailable }

/** Publishes the widget's content, or clears it with `null`. */
export const publishWidget = (content: HomeWidgetPayload | null): void => {
  publishHomeWidget(content)
}

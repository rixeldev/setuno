package com.rixeldev.setuno.widget

import android.content.Context

/** The widget's content, as the app last pushed it. */
data class WidgetData(
  val bandName: String,
  val title: String,
  val subtitle: String,
  val detail: String,
  val route: String,
)

/**
 * Where the widget's content lives between the app pushing it and the
 * launcher drawing it.
 *
 * The widget runs in the app's own process, so the shared preferences are
 * the simplest place for it: no service, no receiver of its own, nothing to
 * keep alive.
 */
object SetunoWidgetStore {
  private const val PREFS = "setuno_widget"
  private const val KEY_BAND = "band"
  private const val KEY_TITLE = "title"
  private const val KEY_SUBTITLE = "subtitle"
  private const val KEY_DETAIL = "detail"
  private const val KEY_ROUTE = "route"

  /** Stores the payload the app pushed. Empty strings mean "nothing to show". */
  fun write(context: Context, payload: Map<String, Any?>) {
    context
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_BAND, payload["bandName"] as? String ?: "")
      .putString(KEY_TITLE, payload["title"] as? String ?: "")
      .putString(KEY_SUBTITLE, payload["subtitle"] as? String ?: "")
      .putString(KEY_DETAIL, payload["detail"] as? String ?: "")
      .putString(KEY_ROUTE, payload["route"] as? String ?: "")
      .apply()
  }

  /** The last payload the app pushed, or empty strings when there is none. */
  fun read(context: Context): WidgetData {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return WidgetData(
      bandName = prefs.getString(KEY_BAND, "") ?: "",
      title = prefs.getString(KEY_TITLE, "") ?: "",
      subtitle = prefs.getString(KEY_SUBTITLE, "") ?: "",
      detail = prefs.getString(KEY_DETAIL, "") ?: "",
      route = prefs.getString(KEY_ROUTE, "") ?: "",
    )
  }
}

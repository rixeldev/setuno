package com.rixeldev.setuno.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/**
 * Draws Setuno's home-screen widget.
 *
 * The widget never asks for anything: the app pushes the content and the
 * provider draws whatever is in the store. That is what keeps the launcher
 * free of a service and the widget free of permissions.
 */
class SetunoWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    appWidgetIds.forEach { render(context, appWidgetManager, it) }
  }

  companion object {
    /** The scheme the app answers on (`app.config.js` → `expo.scheme`). */
    private const val APP_SCHEME = "setuno"

    /** Redraws every widget on the home screen. */
    fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(
        ComponentName(context, SetunoWidgetProvider::class.java),
      )
      if (ids.isEmpty()) return
      ids.forEach { render(context, manager, it) }
    }

    private fun render(context: Context, manager: AppWidgetManager, widgetId: Int) {
      val data = SetunoWidgetStore.read(context)
      val views = RemoteViews(context.packageName, R.layout.widget_setuno)
      views.setTextViewText(R.id.widget_band, data.bandName)
      views.setTextViewText(R.id.widget_title, data.title)
      views.setTextViewText(R.id.widget_subtitle, data.subtitle)
      views.setTextViewText(R.id.widget_detail, data.detail)
      views.setOnClickPendingIntent(R.id.widget_root, openApp(context, data.route))
      manager.updateAppWidget(widgetId, views)
    }

    /** Opens the app — on the gig the widget shows, when it knows one. */
    private fun openApp(context: Context, route: String): PendingIntent {
      val intent = if (route.isNotEmpty()) {
        Intent(Intent.ACTION_VIEW, Uri.parse("$APP_SCHEME://$route"))
      } else {
        context.packageManager.getLaunchIntentForPackage(context.packageName)
          ?: Intent(Intent.ACTION_MAIN)
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      return PendingIntent.getActivity(
        context,
        0,
        intent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
    }
  }
}

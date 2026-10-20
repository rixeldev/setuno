package com.rixeldev.setuno.widget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The bridge between the app and the home-screen widget (roadmap #78).
 *
 * The app sends an already localized payload; the module stores it and asks
 * the provider to draw. The widget therefore speaks the band's language
 * without the launcher ever seeing the app's translations.
 */
class SetunoWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SetunoWidget")

    Function("updateWidget") { payload: Map<String, Any?> ->
      val context = appContext.reactContext
      if (context != null) {
        SetunoWidgetStore.write(context, payload)
        SetunoWidgetProvider.refresh(context)
      }
    }
  }
}

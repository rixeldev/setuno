import React from "react"
import { Redirect, useLocalSearchParams } from "expo-router"

import { deepLinkRoute } from "@/libs/deepLinks"

/**
 * The public link shape of a setlist (roadmap #76): `/setlist/<id>` is what a
 * member sends to a bandmate, and it resolves to the app's own setlist
 * screen — the public name never moves with the app's internal routing.
 */
export default function SetlistDeepLink() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const route = deepLinkRoute(`/setlist/${id ?? ""}`)
  return <Redirect href={route ?? "/"} />
}

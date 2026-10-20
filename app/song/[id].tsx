import React from "react"
import { Redirect, useLocalSearchParams } from "expo-router"

import { deepLinkRoute } from "@/libs/deepLinks"

/**
 * The public link shape of a song (roadmap #76): `/song/<id>` is what a member
 * sends to a bandmate, and it resolves to the app's own song screen — the
 * public name never moves with the app's internal routing.
 *
 * A signed-out visitor lands on the sign-in screen (the `(app)` group owns
 * that guard), exactly like any other link into the band.
 */
export default function SongDeepLink() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const route = deepLinkRoute(`/song/${id ?? ""}`)
  return <Redirect href={route ?? "/"} />
}

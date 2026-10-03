import { Stack } from "expo-router"

/**
 * Single-screen hub (no TabBar). Every game is listed on the home screen and
 * the mode (Offline / Computer / Online) is chosen from a modal.
 */
export default function HubLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}

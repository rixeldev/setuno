import React from "react"
import { Redirect, Stack } from "expo-router"

import { AppShell } from "@/components/app/AppShell"
import { useAuth } from "@/hooks/useAuth"
import { useReaderDirection } from "@/hooks/useReaderSession"
import { Theme } from "@/constants/Theme"

/** Deep links open with the dashboard underneath, so back always lands there. */
export const unstable_settings = { anchor: "index" }

/**
 * Authenticated area. Every screen shares the responsive shell (sidebar on
 * Web/desktop, bottom navigation on mobile). Users without a band stay inside
 * the app and create one whenever they want (docs §7).
 */
export default function AppLayout() {
  const { status } = useAuth()
  const readerDirection = useReaderDirection()

  if (status === "signed-out") return <Redirect href="/(auth)/sign-in" />

  return (
    <AppShell>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          animationDuration: 180,
          contentStyle: { backgroundColor: Theme.colors.background },
        }}
      >
        {/* Tab roots swap instantly (docs §18); pushes inside a tab keep the
            native stack transition. */}
        <Stack.Screen name="index" options={{ animation: "none" }} />
        {/* First-run welcome + guided tour (roadmap #65); hides the shell. */}
        <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
        <Stack.Screen name="songs/index" options={{ animation: "none" }} />
        <Stack.Screen name="songs/new" />
        {/* Stepping through an event's setlist replaces this screen; the
            direction makes the transition animate forwards or backwards. */}
        <Stack.Screen
          name="songs/[id]/index"
          options={{ animationTypeForReplace: readerDirection }}
        />
        <Stack.Screen name="songs/[id]/edit" />
        <Stack.Screen name="songs/[id]/suggest" />
        <Stack.Screen name="songs/[id]/history" options={modalOptions} />
        {/* Trash and recovery (roadmap #31): admin list of soft-deleted songs. */}
        <Stack.Screen name="songs/trash" options={modalOptions} />
        {/* Personal notes of one song (roadmap #3). */}
        <Stack.Screen name="annotations/[id]" options={modalOptions} />
        <Stack.Screen name="setlists/index" options={{ animation: "none" }} />
        <Stack.Screen name="setlists/new" options={modalOptions} />
        <Stack.Screen name="setlists/[id]/index" />
        <Stack.Screen name="setlists/[id]/edit" options={modalOptions} />
        <Stack.Screen name="performances/index" options={{ animation: "none" }} />
        <Stack.Screen name="performances/new" options={modalOptions} />
        <Stack.Screen name="performances/[id]/index" />
        {/* Post-gig show report (#45): write-through review, so a plain push. */}
        <Stack.Screen name="performances/[id]/report" />
        <Stack.Screen name="performances/[id]/edit" options={modalOptions} />
        {/* Date polls (roadmap #48): member-proposed, member-voted. */}
        <Stack.Screen name="polls/index" options={modalOptions} />
        <Stack.Screen name="polls/new" options={modalOptions} />
        <Stack.Screen name="polls/[id]" options={modalOptions} />
        {/* Reusable checklists (roadmap #49): a band library stamped onto events. */}
        <Stack.Screen name="checklists/index" options={modalOptions} />
        <Stack.Screen name="checklists/new" options={modalOptions} />
        <Stack.Screen name="checklists/[id]" options={modalOptions} />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="members" options={modalOptions} />
        <Stack.Screen name="suggestions/index" options={modalOptions} />
        <Stack.Screen name="suggestions/new" options={modalOptions} />
        <Stack.Screen name="suggestions/[id]" options={modalOptions} />
        <Stack.Screen name="collections" options={modalOptions} />
        <Stack.Screen name="collections/[id]" options={modalOptions} />
        {/* Derived band stats + the shareable year-in-review card (#35). */}
        <Stack.Screen name="stats" options={modalOptions} />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/profile" options={modalOptions} />
        <Stack.Screen name="settings/organization" options={modalOptions} />
        <Stack.Screen name="settings/notifications" />
        <Stack.Screen name="more" options={{ animation: "none" }} />
        <Stack.Screen name="organizations/index" options={modalOptions} />
        <Stack.Screen name="organizations/new" options={modalOptions} />
      </Stack>
    </AppShell>
  )
}

/**
 * Screens that behave as modals (docs §21): they float over a translucent
 * backdrop instead of pushing a new page, on every platform.
 */
const modalOptions = {
  presentation: "transparentModal",
  animation: "fade",
  contentStyle: { backgroundColor: "transparent" },
} as const
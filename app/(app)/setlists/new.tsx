import React from "react"
import { useRouter } from "expo-router"

import { SetlistForm } from "@/components/setlists/SetlistForm"

/** Create a new setlist (admin only). */
export default function NewSetlist() {
  const router = useRouter()
  return <SetlistForm onSaved={(id) => router.replace(`/setlists/${id}`)} />
}
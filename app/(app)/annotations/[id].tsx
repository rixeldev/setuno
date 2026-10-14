import React from "react"
import { useLocalSearchParams } from "expo-router"

import { AnnotationsForm } from "@/components/annotations/AnnotationsForm"

/**
 * Personal notes of one song (roadmap #3), presented as a modal over the
 * reader. The song title rides in the query string so the form can label the
 * header without another read.
 */
export default function AnnotationsScreen() {
  const { id, title } = useLocalSearchParams<{ id?: string; title?: string }>()
  if (!id) return null
  return <AnnotationsForm songId={id} songTitle={title ?? ""} />
}
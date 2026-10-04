import React from "react"
import { useRouter } from "expo-router"

import { PerformanceForm } from "@/components/performances/PerformanceForm"

/** Schedule a new show (admin only). */
export default function NewPerformance() {
  const router = useRouter()
  return <PerformanceForm onSaved={(id) => router.replace(`/performances/${id}`)} />
}
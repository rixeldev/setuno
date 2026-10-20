import { useCallback, useEffect, useState } from "react"

import { useAuth } from "@/hooks/useAuth"
import { DEVICE_LIST_TICK_MS } from "@/libs/deviceSessions"
import { getThisDeviceToken } from "@/services/notifications"
import { signOutEverywhere, subscribeMyDevices } from "@/services/devices"
import type { DeviceSession } from "@/interfaces"

/**
 * This account's registered devices (roadmap #69). The state is tagged with
 * the uid it belongs to (the #37B pattern): on sign-out or account switch the
 * outgoing list still sits in state for a frame, and reading it as "nothing"
 * keeps the previous account's phones off the new screen — never synced in
 * the effect body. A listener error rides the same tag (`failed`), and
 * `retry` re-subscribes through the effect's `attempt` counter.
 *
 * `now` moves on a timer in an effect — never `Date.now()` during render (the
 * React Compiler purity rule) — so the relative captions re-derive while the
 * screen stays open. `currentToken` is this install's cached push token, read
 * once from the notification module's platform pair: browsers answer `null`
 * and simply never mark a row as their own.
 */
export function useMyDevices() {
  const { user, profile } = useAuth()
  const uid = user?.uid ?? profile?.uid ?? null
  const [state, setState] = useState<{
    uid: string
    devices: DeviceSession[] | null
    failed: boolean
  } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [currentToken, setCurrentToken] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return
    return subscribeMyDevices(
      uid,
      (devices) => setState({ uid, devices, failed: false }),
      () => setState({ uid, devices: null, failed: true }),
    )
  }, [uid, attempt])

  useEffect(() => {
    let cancelled = false
    void getThisDeviceToken()
      .then((token) => {
        if (!cancelled) setCurrentToken(token)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), DEVICE_LIST_TICK_MS)
    return () => clearInterval(tick)
  }, [])

  const tagged = state && state.uid === uid ? state : null
  const retry = useCallback(() => setAttempt((current) => current + 1), [])

  return {
    /** `null` until this account's first snapshot arrives. */
    devices: tagged?.devices ?? null,
    failed: tagged?.failed ?? false,
    currentToken,
    now,
    retry,
    signOutEverywhere,
  }
}

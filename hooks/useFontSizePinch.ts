import { useEffect, useMemo, useRef } from "react"
import type { GestureResponderEvent, GestureResponderHandlers, NativeTouchEvent } from "react-native"

import { pinchFontSize } from "@/libs/readerState"

interface PinchBaseline {
  startSize: number
  startDistance: number
}

interface PinchLatest {
  fontSize: number
  onPreview: (size: number) => void
  onCommit: (size: number) => void
}

/** Distance between two fingers, in screen points. */
const touchDistance = (touches: readonly NativeTouchEvent[]): number => {
  const [first, second] = touches
  if (!first || !second) return 0
  return Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY)
}

/**
 * Two-finger pinch on the lyrics to resize the text (roadmap #5). Only gestures
 * with two touches are claimed, so single-finger scrolling is untouched; the
 * gesture commits on release, so the reader never writes on every move.
 *
 * Everything the gesture needs lives in refs: the responder object is built
 * once and the callbacks always read the freshest props and the in-flight
 * baseline from them, so a font-size preview (which re-renders the reader)
 * never rebuilds the responder mid-gesture. Plain responder props are used
 * instead of `PanResponder` because the compiler lint rejects building a
 * `PanResponder` while rendering.
 */
export const useFontSizePinch = (
  fontSize: number,
  onPreview: (size: number) => void,
  onCommit: (size: number) => void,
): GestureResponderHandlers => {
  const latestRef = useRef<PinchLatest>({ fontSize, onPreview, onCommit })
  const baselineRef = useRef<PinchBaseline | null>(null)
  const currentRef = useRef(0)

  useEffect(() => {
    latestRef.current = { fontSize, onPreview, onCommit }
  }, [fontSize, onPreview, onCommit])

  return useMemo(() => {
    const wantsTwoFingers = (event: GestureResponderEvent): boolean =>
      event.nativeEvent.touches.length >= 2

    const finish = (): void => {
      const baseline = baselineRef.current
      baselineRef.current = null
      if (baseline && currentRef.current !== baseline.startSize) {
        latestRef.current.onCommit(currentRef.current)
      }
    }

    return {
      onStartShouldSetResponderCapture: wantsTwoFingers,
      onMoveShouldSetResponderCapture: wantsTwoFingers,
      onStartShouldSetResponder: wantsTwoFingers,
      onMoveShouldSetResponder: wantsTwoFingers,
      onResponderGrant: (event: GestureResponderEvent) => {
        const touches = event.nativeEvent.touches
        if (touches.length >= 2) {
          baselineRef.current = {
            startSize: latestRef.current.fontSize,
            startDistance: touchDistance(touches),
          }
          currentRef.current = latestRef.current.fontSize
        }
        // Returning `true` blocks the host's native responder on Android, the
        // same default `PanResponder` used. The responder only checks for `true`.
        return true
      },
      onResponderMove: (event: GestureResponderEvent) => {
        const baseline = baselineRef.current
        const touches = event.nativeEvent.touches
        if (!baseline || touches.length < 2) return
        const next = pinchFontSize(
          baseline.startSize,
          baseline.startDistance,
          touchDistance(touches),
        )
        if (next === currentRef.current) return
        currentRef.current = next
        latestRef.current.onPreview(next)
      },
      onResponderRelease: finish,
      onResponderTerminate: finish,
      onResponderTerminationRequest: () => false,
    }
  }, [])
}

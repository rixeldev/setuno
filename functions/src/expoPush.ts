import { logger } from "firebase-functions/v2"

import { chunkMessages, parseTicketFailures, type PushTicketFailure } from "./notify"

/**
 * HTTP sender for the Expo Push Service (roadmap #52). The service is a plain
 * HTTPS endpoint — no SDK and no FCM credentials in the functions workspace:
 * Expo carries each message to FCM/APNs itself and answers with one ticket per
 * message, in order, where an uninstalled app shows up as `DeviceNotRegistered`
 * (the caller prunes those tokens; everything else — rate limits, transient
 * errors — keeps the token for the next send). Batches are capped at 100 by
 * `chunkMessages`, the service's documented limit.
 */
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

export interface ExpoPushMessage {
  to: string
  title: string
  body: string
  sound: "default"
  data?: Record<string, unknown>
}

export const sendExpoPush = async (
  messages: readonly ExpoPushMessage[],
): Promise<PushTicketFailure[]> => {
  const failures: PushTicketFailure[] = []
  for (const batch of chunkMessages(messages)) {
    // A network failure propagates to the caller's per-recipient catch: one
    // dead batch logs once instead of pretending every token is healthy.
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    })
    if (!response.ok) {
      // The service answered but not with tickets (5xx, rate limit at the HTTP
      // layer): leave every token alone and move on.
      logger.warn("sendExpoPush: non-OK response", { status: response.status, size: batch.length })
      continue
    }
    const payload = (await response.json()) as { data?: Parameters<typeof parseTicketFailures>[0] }
    failures.push(...parseTicketFailures(payload.data, batch.map((message) => message.to)))
  }
  return failures
}

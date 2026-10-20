import { createHmac } from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  STRIPE_SIGNATURE_TOLERANCE_SECONDS,
  stripeConfigFromEnv,
  stripePriceFor,
  subscriptionFromStripe,
  verifyStripeSignature,
} from "@/functions/src/stripe"

/**
 * Stripe on the web (roadmap #61): the signature check that decides whether a
 * webhook is really Stripe, and the subscription that becomes an entitlement.
 */

const SECRET = "whsec_test_secret"

const sign = (payload: string, timestamp: number, secret = SECRET): string =>
  `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")}`

describe("verifyStripeSignature", () => {
  const now = 1_700_000_000
  const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" })

  it("accepts a signature Stripe really made", () => {
    expect(
      verifyStripeSignature({
        payload,
        header: sign(payload, now),
        secret: SECRET,
        nowSeconds: now,
      }),
    ).toBe(true)
  })

  it("refuses a body that changed on the way", () => {
    expect(
      verifyStripeSignature({
        payload: `${payload} tampered`,
        header: sign(payload, now),
        secret: SECRET,
        nowSeconds: now,
      }),
    ).toBe(false)
  })

  it("refuses a signature made with another secret", () => {
    expect(
      verifyStripeSignature({
        payload,
        header: sign(payload, now, "whsec_other"),
        secret: SECRET,
        nowSeconds: now,
      }),
    ).toBe(false)
  })

  it("refuses a replayed webhook", () => {
    const old = now - STRIPE_SIGNATURE_TOLERANCE_SECONDS - 60
    expect(
      verifyStripeSignature({
        payload,
        header: sign(payload, old),
        secret: SECRET,
        nowSeconds: now,
      }),
    ).toBe(false)
  })

  it("refuses a missing or empty header", () => {
    expect(
      verifyStripeSignature({ payload, header: null, secret: SECRET, nowSeconds: now }),
    ).toBe(false)
    expect(
      verifyStripeSignature({ payload, header: "", secret: SECRET, nowSeconds: now }),
    ).toBe(false)
  })

  it("refuses a header without a signature", () => {
    expect(
      verifyStripeSignature({
        payload,
        header: `t=${now}`,
        secret: SECRET,
        nowSeconds: now,
      }),
    ).toBe(false)
  })
})

describe("subscriptionFromStripe", () => {
  const subscription = {
    id: "sub_123",
    customer: "cus_123",
    status: "active",
    current_period_end: 1_800_000_000,
    metadata: { uid: "alice", plan: "monthly" },
  }

  it("reads the member and the period out of the metadata", () => {
    const parsed = subscriptionFromStripe(subscription)
    expect(parsed?.uid).toBe("alice")
    expect(parsed?.plan).toBe("monthly")
    expect(parsed?.customerId).toBe("cus_123")
    expect(parsed?.active).toBe(true)
    expect(parsed?.expiresAt).toBe("2027-01-15")
  })

  it("grants nothing to a subscription without our metadata", () => {
    expect(subscriptionFromStripe({ id: "sub_1", metadata: {} })).toBeNull()
    expect(subscriptionFromStripe({ id: "sub_1" })).toBeNull()
  })

  it("does not grant a plan to a cancelled subscription", () => {
    const parsed = subscriptionFromStripe({ ...subscription, status: "canceled" })
    expect(parsed?.active).toBe(false)
  })

  it("treats a trial as active", () => {
    expect(subscriptionFromStripe({ ...subscription, status: "trialing" })?.active).toBe(true)
  })
})

describe("stripeConfigFromEnv", () => {
  const config = {
    secretKey: "sk_test_1",
    webhookSecret: "whsec_1",
    priceMonthly: "price_1",
    priceAnnual: "price_2",
    webOrigin: "https://setuno.vercel.app",
  }

  it("reads a complete configuration", () => {
    expect(stripeConfigFromEnv(JSON.stringify(config))?.priceMonthly).toBe("price_1")
  })

  it("refuses an incomplete or broken configuration", () => {
    expect(stripeConfigFromEnv(undefined)).toBeNull()
    expect(stripeConfigFromEnv("")).toBeNull()
    expect(stripeConfigFromEnv("not json")).toBeNull()
    expect(stripeConfigFromEnv(JSON.stringify({ secretKey: "sk" }))).toBeNull()
  })

  it("maps a plan to its price", () => {
    const parsed = stripeConfigFromEnv(JSON.stringify(config))!
    expect(stripePriceFor(parsed, "monthly")).toBe("price_1")
    expect(stripePriceFor(parsed, "annual")).toBe("price_2")
  })
})

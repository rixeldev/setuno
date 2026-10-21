import { describe, expect, it } from "vitest"

import { PRO_PRODUCTS } from "@/functions/src/entitlements"
import { planOffersFromProducts } from "@/libs/planOffers"

describe("planOffersFromProducts", () => {
  it("reads the base plans out of the subscription container", () => {
    const offers = planOffersFromProducts([
      {
        id: PRO_PRODUCTS.subscription,
        subscriptionOffers: [
          {
            basePlanIdAndroid: PRO_PRODUCTS.monthly,
            displayPrice: "$3.99",
            id: PRO_PRODUCTS.monthly,
            offerTokenAndroid: "token-monthly",
          },
          {
            basePlanIdAndroid: PRO_PRODUCTS.annual,
            displayPrice: "$34.99",
            id: PRO_PRODUCTS.annual,
            offerTokenAndroid: "token-annual",
          },
        ],
      },
    ])

    expect(offers).toEqual([
      { id: "monthly", price: "$3.99", productId: "setuno_pro", offerToken: "token-monthly" },
      { id: "annual", price: "$34.99", productId: "setuno_pro", offerToken: "token-annual" },
    ])
  })

  it("keeps the screen's own order (monthly, then annual)", () => {
    const offers = planOffersFromProducts([
      {
        id: PRO_PRODUCTS.subscription,
        subscriptionOffers: [
          {
            basePlanIdAndroid: PRO_PRODUCTS.annual,
            displayPrice: "$34.99",
            id: PRO_PRODUCTS.annual,
            offerTokenAndroid: "token-annual",
          },
          {
            basePlanIdAndroid: PRO_PRODUCTS.monthly,
            displayPrice: "$3.99",
            id: PRO_PRODUCTS.monthly,
            offerTokenAndroid: "token-monthly",
          },
        ],
      },
    ])

    expect(offers.map((offer) => offer.id)).toEqual(["monthly", "annual"])
  })

  it("accepts a store configured with one product per period", () => {
    const offers = planOffersFromProducts([
      {
        id: PRO_PRODUCTS.monthly,
        subscriptionOffers: [
          {
            basePlanIdAndroid: "some-base-plan",
            displayPrice: "$3.99",
            id: "some-base-plan",
            offerTokenAndroid: "token-monthly",
          },
        ],
      },
    ])

    expect(offers).toEqual([
      { id: "monthly", price: "$3.99", productId: "monthly", offerToken: "token-monthly" },
    ])
  })

  it("drops an offer the store could not sell (no token, no price)", () => {
    const offers = planOffersFromProducts([
      {
        id: PRO_PRODUCTS.subscription,
        subscriptionOffers: [
          {
            basePlanIdAndroid: PRO_PRODUCTS.monthly,
            displayPrice: "$3.99",
            id: PRO_PRODUCTS.monthly,
            offerTokenAndroid: null,
          },
          {
            basePlanIdAndroid: PRO_PRODUCTS.annual,
            displayPrice: "",
            id: PRO_PRODUCTS.annual,
            offerTokenAndroid: "token-annual",
          },
        ],
      },
    ])

    expect(offers).toEqual([])
  })

  it("ignores a base plan the app does not sell", () => {
    const offers = planOffersFromProducts([
      {
        id: PRO_PRODUCTS.subscription,
        subscriptionOffers: [
          {
            basePlanIdAndroid: "lifetime",
            displayPrice: "$199.99",
            id: "lifetime",
            offerTokenAndroid: "token-lifetime",
          },
        ],
      },
    ])

    expect(offers).toEqual([])
  })

  it("prefers the base plan's own offer over a promotional one", () => {
    const offers = planOffersFromProducts([
      {
        id: PRO_PRODUCTS.subscription,
        subscriptionOffers: [
          {
            basePlanIdAndroid: PRO_PRODUCTS.monthly,
            displayPrice: "$0.99",
            id: "intro-offer",
            offerTokenAndroid: "token-intro",
          },
          {
            basePlanIdAndroid: PRO_PRODUCTS.monthly,
            displayPrice: "$3.99",
            id: PRO_PRODUCTS.monthly,
            offerTokenAndroid: "token-monthly",
          },
        ],
      },
    ])

    expect(offers).toEqual([
      { id: "monthly", price: "$3.99", productId: "setuno_pro", offerToken: "token-monthly" },
    ])
  })

  it("answers nothing for an empty catalogue", () => {
    expect(planOffersFromProducts([])).toEqual([])
  })
})

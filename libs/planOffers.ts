import { PRO_PRODUCTS } from "@/functions/src/entitlements"

/**
 * Reads the Pro plans out of a Google Play catalogue (roadmap #61).
 *
 * Play Billing 5+ sells a **subscription** (`setuno_pro`) that holds **base
 * plans** (`monthly`, `annual`). A base plan id is **not** a product id: asking
 * the store for `"monthly"` answers nothing at all, which is why the plan
 * screen said the plan was not offered in a build whose store was perfectly
 * configured. The catalogue is the subscription, and each base plan is picked
 * out of its offers (`basePlanIdAndroid`), whose `offerTokenAndroid` is what a
 * purchase has to carry — Billing 5+ refuses a subscription purchase without
 * one.
 *
 * The helper is pure and takes the store's products as a structural subset, so
 * it unit-tests without expo-iap or a device.
 */

/** A plan the band can buy right now. */
export interface PlanOffer {
  /** The base plan id the screen looks up: `monthly` or `annual`. */
  id: string
  /** The price the store printed for it ("$3.99"). */
  price: string
  /** The subscription product the store expects ("setuno_pro"). */
  productId: string
  /** The token Play Billing 5+ demands for that base plan. */
  offerToken: string
}

/** The slice of expo-iap's subscription product this needs. */
export interface StoreSubscriptionLike {
  id: string
  subscriptionOffers?: readonly StoreOfferLike[] | null
}

/** The slice of expo-iap's subscription offer this needs. */
export interface StoreOfferLike {
  /** The base plan the offer belongs to. */
  basePlanIdAndroid?: string | null
  displayPrice?: string
  /** The offer's own id; the base plan's plain offer spells it like the base plan. */
  id?: string
  /** The token a purchase must carry (Billing 5+). */
  offerTokenAndroid?: string | null
}

/** The base plans the plan screen knows how to sell. */
const PLAN_IDS: readonly string[] = [PRO_PRODUCTS.monthly, PRO_PRODUCTS.annual]

/**
 * The plan a catalogue entry sells.
 *
 * The live catalogue names its base plans; a store configured with one product
 * per period (two standalone subscriptions) is accepted too, by its product id.
 */
const planIdFor = (product: StoreSubscriptionLike, offer: StoreOfferLike): string | null => {
  const basePlanId = offer.basePlanIdAndroid ?? ""
  if (PLAN_IDS.includes(basePlanId)) return basePlanId
  if (PLAN_IDS.includes(product.id)) return product.id
  return null
}

/** True for the base plan's own offer, as opposed to a promotional one. */
const isPlanOffer = (offer: StoreOfferLike, basePlanId: string): boolean =>
  !offer.id || offer.id === basePlanId

/**
 * Every base plan the catalogue offers, in the screen's own order (`monthly`,
 * then `annual`). An offer without a token or without a price is not sellable
 * and is dropped: Play Billing would refuse the purchase anyway, and the screen
 * would only offer a button that cannot work.
 */
export const planOffersFromProducts = (
  products: readonly StoreSubscriptionLike[],
): PlanOffer[] => {
  const found = new Map<string, PlanOffer>()
  for (const product of products) {
    for (const offer of product.subscriptionOffers ?? []) {
      const id = planIdFor(product, offer)
      if (!id) continue
      const offerToken = offer.offerTokenAndroid ?? ""
      const price = offer.displayPrice ?? ""
      if (offerToken.length === 0 || price.length === 0) continue
      // Play lists the base plan's own offer beside any promotional one; the
      // plan itself is the one to show (a promo quotes a temporary price and
      // then charges the plan).
      if (found.has(id) && !isPlanOffer(offer, id)) continue
      found.set(id, { id, price, productId: product.id, offerToken })
    }
  }
  return PLAN_IDS.flatMap((id) => {
    const offer = found.get(id)
    return offer ? [offer] : []
  })
}

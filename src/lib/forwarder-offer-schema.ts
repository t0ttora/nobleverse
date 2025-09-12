import offerSchema from './forwarder_offer_schema.json';

export type OfferConfig = typeof offerSchema.forwarder_offer;
export type OfferSection = OfferConfig['sections'][number];
export type OfferField = OfferSection['fields'][number] & {
  options?: string[];
  currency?: string[];
};

export function getOfferConfig(): OfferConfig {
  return offerSchema.forwarder_offer as OfferConfig;
}

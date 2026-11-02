export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  mode: 'subscription' | 'payment';
  features: string[];
}

export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    id: 'prod_VGaR1UwVJxWBa1',
    priceId: 'price_1UG3GxGeegvFIqACTTpeqq4n',
    name: 'Pro',
    description: 'Everything a working promoter needs — offers, the math, settlements, tours and the AI.',
    price: 99.00,
    currency: 'USD',
    mode: 'subscription',
    features: [
      'Full Offer Builder (all deal structures) + PDFs',
      'Settlements, deposits, run of show',
      'Unlimited events & offers',
      'Unlimited tours',
      'Tour Management tab',
      'AI Insights & Deal Analyzer',
      'Deals scored 0-100',
      'STRONG BUY / PROCEED / CAUTION / PASS recommendations'
    ]
  }
];

export function getProductByPriceId(priceId: string): StripeProduct | undefined {
  return STRIPE_PRODUCTS.find(product => product.priceId === priceId);
}
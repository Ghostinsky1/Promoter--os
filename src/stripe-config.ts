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
    id: 'prod_VGaRoeNJvg9HvX',
    priceId: 'price_1UG3GwGeegvFIqACVrur7gDr',
    name: 'Starter',
    description: 'Professional offer generation and management tools',
    price: 39.00,
    currency: 'USD',
    mode: 'subscription',
    features: [
      'Up to 10 active events',
      '1 seat (single user)',
      'Full Offer Builder (all 4 deal structures)',
      'Professional PDF generation',
      'Settlement tracking',
      'Run of show management'
    ]
  },
  {
    id: 'prod_VGaR1UwVJxWBa1',
    priceId: 'price_1UG3GxGeegvFIqACTTpeqq4n',
    name: 'Pro',
    description: 'Advanced features for growing concert promoters',
    price: 99.00,
    currency: 'USD',
    mode: 'subscription',
    features: [
      'Everything in Starter, plus:',
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
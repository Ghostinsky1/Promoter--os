export interface SubscriptionFeatures {
  offerBuilder: boolean;
  pdfGeneration: boolean;
  settlementTracking: boolean;
  calendarView: boolean;
  database: boolean;
  expenseTemplates: boolean;
  importData: boolean;
  tours: boolean;
  aiInsights: boolean;
  dealAnalyzer: boolean;
  aiConnector: boolean;
  advancedAI?: boolean;
  teamCollaboration?: boolean;
  customBranding?: boolean;
  analytics: 'basic' | 'enhanced' | 'advanced';
  support: 'email' | 'priority' | 'dedicated';
  apiAccess?: boolean;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  maxOffers: number;
  maxSeats: number;
  features: SubscriptionFeatures;
  stripeProductId: string;
  stripePriceId: string;
}

export const SUBSCRIPTION_TIERS: Record<string, SubscriptionTier> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 39,
    maxOffers: 10,
    maxSeats: 1,
    stripeProductId: 'prod_TWz6FttdA8zmct',
    stripePriceId: 'price_1SZv8NK0rX2Uf9BVDhRmDFcN',
    features: {
      offerBuilder: true,
      pdfGeneration: true,
      settlementTracking: true,
      calendarView: true,
      database: true,
      expenseTemplates: true,
      importData: true,
      tours: false,
      aiInsights: false,
      dealAnalyzer: false,
      aiConnector: false,
      analytics: 'basic',
      support: 'email'
    }
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 99,
    maxOffers: -1,
    maxSeats: 2,
    stripeProductId: 'prod_TaCkDOjKZfrycS',
    stripePriceId: 'price_1Sd2LGK0rX2Uf9BVwPgHLijQ',
    features: {
      offerBuilder: true,
      pdfGeneration: true,
      settlementTracking: true,
      calendarView: true,
      database: true,
      expenseTemplates: true,
      importData: true,
      tours: true,
      aiInsights: true,
      dealAnalyzer: true,
      aiConnector: true,
      analytics: 'enhanced',
      support: 'priority'
    }
  },
  agency_scale: {
    id: 'agency_scale',
    name: 'Agency Scale',
    price: 297,
    maxOffers: -1,
    maxSeats: 5,
    stripeProductId: '',
    stripePriceId: '',
    features: {
      offerBuilder: true,
      pdfGeneration: true,
      settlementTracking: true,
      calendarView: true,
      database: true,
      expenseTemplates: true,
      importData: true,
      tours: true,
      aiInsights: true,
      dealAnalyzer: true,
      aiConnector: true,
      advancedAI: true,
      teamCollaboration: true,
      customBranding: true,
      analytics: 'advanced',
      support: 'dedicated',
      apiAccess: true
    }
  }
};

export function getSubscriptionTier(tierId: string): SubscriptionTier {
  return SUBSCRIPTION_TIERS[tierId] || SUBSCRIPTION_TIERS.starter;
}

export function hasFeature(tierId: string, feature: keyof SubscriptionFeatures): boolean {
  const tier = getSubscriptionTier(tierId);
  const featureValue = tier.features[feature];
  return featureValue === true;
}

export function canCreateMoreOffers(tierId: string, currentCount: number): boolean {
  const tier = getSubscriptionTier(tierId);
  if (tier.maxOffers === -1) return true;
  return currentCount < tier.maxOffers;
}

export function canAddMoreSeats(tierId: string, currentSeats: number): boolean {
  const tier = getSubscriptionTier(tierId);
  return currentSeats < tier.maxSeats;
}

export function getTierFeatureList(tierId: string): string[] {
  const tier = getSubscriptionTier(tierId);
  const features: string[] = [];

  if (tier.maxOffers === -1) {
    features.push('Unlimited events & offers');
  } else {
    features.push(`Up to ${tier.maxOffers} active events`);
  }

  features.push(`${tier.maxSeats} seat${tier.maxSeats > 1 ? 's' : ''}`);

  if (tier.features.offerBuilder) features.push('Full Offer Builder (all 4 deal structures)');
  if (tier.features.pdfGeneration) features.push('Professional PDF generation');
  if (tier.features.settlementTracking) features.push('Settlement tracking');
  if (tier.features.tours) features.push('Tour Management');
  if (tier.features.aiInsights) features.push('AI Insights & Deal Analyzer');
  if (tier.features.dealAnalyzer) features.push('Deals scored 0-100');
  if (tier.features.aiConnector) features.push('AI connector (run your events from Claude)');
  if (tier.features.advancedAI) features.push('Advanced AI tools');
  if (tier.features.teamCollaboration) features.push('Team collaboration');
  if (tier.features.customBranding) features.push('Custom branding & white-label PDFs');
  if (tier.features.apiAccess) features.push('API access');

  return features;
}

/** Plans that can connect Promoter OS to an AI assistant (the MCP connector). */
export const AI_CONNECTOR_TIERS = ['pro', 'agency_scale'];

export function canUseAiConnector(tierId: string): boolean {
  return AI_CONNECTOR_TIERS.includes(tierId);
}

/** Plans that can scan an uploaded settlement. Costs a few cents per document,
 *  so it sits behind the same gate as the AI connector. */
export const DOC_IMPORT_TIERS = ['pro', 'agency_scale'];

export function canImportDocuments(tierId: string): boolean {
  return DOC_IMPORT_TIERS.includes(tierId);
}

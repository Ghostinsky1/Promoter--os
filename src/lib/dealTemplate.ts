import type { Expenses, TicketTier } from '../types';

/**
 * A deal template is the whole deal setup (Jose, Oct 20): deal type and splits, deposit and
 * payment terms, ticket tiers, expense lines, fees and rates, artist travel/hospitality.
 * The template's own columns hold what the old Templates feature already stored; everything
 * else rides in `templates.deal` under the offer column's own name.
 */
export const DEAL_KEYS = [
  'guarantee', 'artist_percentage', 'artist_backend_pct', 'promoter_backend_pct',
  'balance_due_timing', 'payment_method', 'settlement_days',
  'merch_rate_soft', 'merch_rate_hard', 'age_limit',
  'comps_artist', 'comps_venue', 'comps_promoter',
  'include_hotel', 'hotel_budget', 'hotel_nights', 'include_transport', 'transport_budget',
  'include_flights', 'flight_budget', 'include_rider', 'rider_cap',
] as const;
export type DealKey = (typeof DEAL_KEYS)[number];

const COLUMN_KEYS = [
  'deal_type', 'deposit_pct', 'deposit_due_timing', 'tax_withholding_pct', 'sales_tax_pct',
  'facility_fee_per_ticket', 'facility_fee_mode', 'artist_pct_basis', 'door_split_basis',
  'ascap_rate', 'bmi_rate', 'sesac_rate', 'insurance_per_attendee', 'cc_fee_rate',
  'include_extra_revenue', 'extra_revenue',
] as const;

export const DEAL_LABEL: Record<string, string> = {
  flat_fee: 'Flat fee', flat_guarantee: 'Flat fee', guarantee_vs_percentage: 'Guarantee vs %',
  percentage_only: '% only', percentage: '% only', door_deal: 'Door deal', promoter_profit: 'Promoter profit split',
};

/** "Guarantee vs 85%" — a one-line read of the deal. */
export function dealLine(t: any): string {
  const deal = { ...(t?.deal || {}), ...t };
  const type = deal.deal_type || 'flat_fee';
  const pct = deal.artist_percentage != null ? `${Number(deal.artist_percentage)}%` : '';
  const g = Number(deal.guarantee) > 0 ? `$${Math.round(Number(deal.guarantee)).toLocaleString()}` : '';
  if (type === 'guarantee_vs_percentage') return `${g || 'Guarantee'} vs ${pct || '%'}`;
  if (type === 'percentage_only' || type === 'percentage') return `${pct || '%'} of ${deal.artist_pct_basis === 'gross' ? 'gross' : 'net'}`;
  if (type === 'door_deal') return `Door deal ${pct ? pct + ' artist' : ''}`.trim();
  if (type === 'promoter_profit') return `Profit split ${deal.artist_backend_pct ?? 85}/${deal.promoter_backend_pct ?? 15}`;
  return `${DEAL_LABEL[type] || type}${g ? ' ' + g : ''}`;
}

/** Save an offer's deal as a template row. */
export function templateFromOffer(offer: any, extra: { name: string; description?: string; user_id: string; organization_id: string; legal_terms?: string }) {
  const expenseCategories = Object.keys(offer.expenses || {}).map((category) => ({
    title: category.charAt(0).toUpperCase() + category.slice(1),
    items: Object.entries(offer.expenses[category] || {}).map(([name, amount]) => ({ name, default_amount: Number(amount) || 0 })),
  }));
  const row: Record<string, any> = {
    ...extra,
    type: 'event',
    deposit_due_timing: offer.deposit_due_timing || '30_days_before',
    ticket_tier_templates: (offer.ticket_tiers || []).map((t: TicketTier) => ({ type: t.type, price: t.price, default_allotment: t.allotment, default_comps: t.comps })),
    expense_categories: expenseCategories,
    deal: Object.fromEntries(DEAL_KEYS.filter((k) => offer[k] !== undefined && offer[k] !== null).map((k) => [k, offer[k]])),
  };
  for (const k of COLUMN_KEYS) if (offer[k] !== undefined && row[k] === undefined) row[k] = offer[k];
  return row;
}

/** A template as offer columns, ready to lay over an offer's defaults. */
export function offerFieldsFromTemplate(t: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of COLUMN_KEYS) if (t?.[k] !== undefined && t[k] !== null) out[k] = t[k];
  for (const k of DEAL_KEYS) if (t?.deal?.[k] !== undefined && t.deal[k] !== null) out[k] = t.deal[k];
  if (Array.isArray(t?.ticket_tier_templates) && t.ticket_tier_templates.length) {
    out.ticket_tiers = t.ticket_tier_templates.map((tt: any) => ({ type: tt.type || 'GA', allotment: tt.default_allotment || 0, comps: tt.default_comps || 0, price: tt.price || 0 }));
  }
  if (Array.isArray(t?.expense_categories) && t.expense_categories.length) out.expenses = expensesFromTemplate(t);
  return out;
}

export function expensesFromTemplate(t: any): Expenses {
  const e: Expenses = { talent: {}, general: {}, marketing: {}, production: {} };
  for (const c of t?.expense_categories || []) {
    const key = String(c.title || '').toLowerCase();
    const cat: keyof Expenses = key === 'talent' || key === 'marketing' || key === 'production' ? key : 'general';
    for (const it of c.items || []) e[cat][it.name] = Number(it.default_amount) || 0;
  }
  return e;
}

export const expenseTotal = (e: Expenses | undefined) =>
  e ? Object.values(e).reduce((s, cat) => s + Object.values(cat || {}).reduce((a, v) => a + (Number(v) || 0), 0), 0) : 0;

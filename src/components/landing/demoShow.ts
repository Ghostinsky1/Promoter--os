import { calculateFromOffer } from '../../lib/calculations';
import { survivalRead } from '../../lib/downside';

/** The one show every landing-page demo talks about. Real math, so the numbers agree everywhere. */
export const SHOW = { artist: 'Flores Negras', venue: 'Mississippi Underground', city: 'St. Louis', date: '2026-11-20', cap: 800, price: 20, fee: 4000, costs: 3200, ads: 800 };

const DEFAULTS = {
  mode: 'estimate', status: 'planning', deal_type: 'flat_fee', artist_percentage: 100,
  facility_fee_mode: 'on_top', artist_pct_basis: 'net_after_costs', door_split_basis: 'net_after_costs',
  tax_withholding_pct: 2, deposit_pct: 20, artist_backend_pct: 85, promoter_backend_pct: 15,
  sales_tax_pct: 13.18, include_extra_revenue: false, extra_revenue: [], support_acts: [], artist_deductions: [],
  ascap_rate: 0.0023, bmi_rate: 0.003, sesac_rate: 0.000214, insurance_per_attendee: 0.62, cc_fee_rate: 0.012,
  facility_fee_per_ticket: 2, comps_artist: 0, comps_venue: 0, comps_promoter: 0,
};

let cached: ReturnType<typeof compute> | null = null;
function compute() {
  const draft: any = {
    ...DEFAULTS, guarantee: SHOW.fee,
    ticket_tiers: [{ type: 'GA', allotment: SHOW.cap, comps: 0, price: SHOW.price }],
    expenses: { talent: {}, general: { show_costs: SHOW.costs }, marketing: { paid_social: SHOW.ads }, production: {} },
  };
  const calc = calculateFromOffer(draft, 'estimate');
  const r = survivalRead({ ...draft, calculations: calc, show: { capacity: SHOW.cap } });
  return { calc, r };
}
export function demoRead() { return (cached ||= compute()); }

/** A plain 0–100 read of the deal for the demo dial: how far past break-even a sellout lands. */
export function demoScore() {
  const { r } = demoRead();
  if (r.breakEvenTickets < 0) return 12;
  const margin = 1 - r.breakEvenTickets / SHOW.cap; // share of the room that is profit
  return Math.round(Math.min(96, Math.max(8, 30 + margin * 120)));
}

/**
 * PROMOTER OS — the tour pipeline (Jose, Oct 20).
 *
 * One pipeline per tour. A venue starts as a LEAD (a quick row: venue, city, contact, what we
 * sent, next step, a rough profit guess). "Make offer" turns it into a real offer; from then on
 * the offer's own status moves the card. Offers added to the tour without a lead show up too.
 *
 *   Lead → Contacted → Talking → On hold → Offer sent → Confirmed → Settled   (+ Dead)
 *
 * Money, the way Jose asked for it:
 *   Made            settled shows, actual profit
 *   Closed          confirmed shows, projected profit (locked, not played yet)
 *   Trying to close talking / on hold / offer sent — the offer's projection, or the lead's guess
 *   Early leads     lead / contacted — the lead's guess
 *   Tour costs      costs that belong to the whole run
 *   Tour P/L        Made − tour costs (settled money only; projections never count as made)
 */
import { parseLocalDate } from './dateHelpers';

export type Stage = 'lead' | 'contacted' | 'talking' | 'hold' | 'offer_sent' | 'confirmed' | 'settled' | 'dead';
export type LeadStage = 'lead' | 'contacted' | 'talking' | 'hold' | 'dead';

export const STAGES: { key: Stage; label: string; color: string; hint: string }[] = [
  { key: 'lead', label: 'To contact', color: '#93A2B8', hint: 'Not reached out yet' },
  { key: 'contacted', label: 'Contacted', color: '#5A8CFF', hint: 'Emailed, called or DM’d — waiting' },
  { key: 'talking', label: 'Talking', color: '#F2B640', hint: 'Back and forth on a date or deal' },
  { key: 'hold', label: 'On hold', color: '#F0605A', hint: 'Date held, not signed' },
  { key: 'offer_sent', label: 'Offer sent', color: '#8FD3FF', hint: 'They have the paper' },
  { key: 'confirmed', label: 'Confirmed', color: '#4ADE80', hint: 'Locked. Counts.' },
  { key: 'settled', label: 'Settled', color: '#FFFFFF', hint: 'Played and settled' },
  { key: 'dead', label: 'Dead', color: '#4B5563', hint: 'Said no, released or cancelled' },
];
export const STAGE = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<Stage, (typeof STAGES)[number]>;
export const LEAD_STAGES: LeadStage[] = ['lead', 'contacted', 'talking', 'hold', 'dead'];

export interface TourLead {
  id: string;
  organization_id: string;
  tour_id: string;
  venue: string;
  city: string;
  region: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  event_date: string | null;
  stage: LeadStage;
  contact: string | null;
  sent: string | null;
  next_step: string | null;
  notes: string | null;
  est_profit: number | null;
  offer_id: string | null;
  position: number;
  updated_at: string;
}

export interface TourCost { id: string; tour_id: string; organization_id: string; label: string; amount: number }

/** One card on the board / one dot on the globe. */
export interface Card {
  key: string;                 // lead id, or "offer:<id>" for an offer with no lead
  lead: TourLead | null;
  offer: any | null;           // offers row with show
  stage: Stage;
  venue: string;
  city: string;
  region: string | null;
  date: string | null;         // YYYY-MM-DD
  lat: number | null;
  lng: number | null;
  money: number | null;        // actual profit (settled), projected profit (offer), or the lead's guess
  moneyKind: 'actual' | 'projected' | 'estimate' | null;
  contact: string | null;
  next: string | null;
  sent: string | null;
  notes: string | null;
}

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

/** The stage an offer puts its card in. Planning keeps the lead's own stage (still talking). */
export function stageFromOffer(offer: any, lead: TourLead | null): Stage {
  const s = offer?.status || 'planning';
  if (s === 'settled' || offer?.is_settled) return 'settled';
  if (s === 'confirmed' || s === 'active') return 'confirmed';
  if (s === 'offer_sent') return 'offer_sent';
  if (s === 'cancelled') return 'dead';
  return lead && lead.stage !== 'dead' ? lead.stage : 'talking';
}

function cityOf(offer: any): { city: string; region: string | null } {
  const c = (offer?.venue_city || '').trim();
  if (c) return { city: c, region: offer?.venue_state || null };
  const after = String(offer?.show?.venue_name || '').split(',').slice(1).join(',').trim();
  return { city: after || '', region: offer?.venue_state || null };
}

export function buildCards(leads: TourLead[], offers: any[], settlements: Record<string, any>): Card[] {
  const byOffer = new Map(leads.filter((l) => l.offer_id).map((l) => [l.offer_id as string, l]));
  const cards: Card[] = [];
  for (const l of leads) {
    const offer = l.offer_id ? offers.find((o) => o.id === l.offer_id) ?? null : null;
    cards.push(card(l, offer, settlements));
  }
  for (const o of offers) if (!byOffer.has(o.id)) cards.push(card(null, o, settlements));
  return cards;
}

function card(lead: TourLead | null, offer: any | null, settlements: Record<string, any>): Card {
  const stage: Stage = offer ? stageFromOffer(offer, lead) : (lead!.stage as Stage);
  const where = offer ? cityOf(offer) : null;
  let money: number | null = null;
  let moneyKind: Card['moneyKind'] = null;
  if (offer) {
    const st = settlements[offer.id];
    if (stage === 'settled' && (st || offer.actual_profit != null)) { money = n(st?.actual_profit ?? offer.actual_profit); moneyKind = 'actual'; }
    else if (offer.calculations?.netProfit != null) { money = n(offer.calculations.netProfit); moneyKind = 'projected'; }
  } else if (lead?.est_profit != null) { money = n(lead.est_profit); moneyKind = 'estimate'; }
  return {
    key: lead ? lead.id : `offer:${offer.id}`,
    lead, offer, stage,
    venue: lead?.venue || offer?.show?.venue_name?.split(',')[0] || 'Venue',
    city: lead?.city || where?.city || '',
    region: lead?.region ?? where?.region ?? null,
    date: offer?.show?.event_date || lead?.event_date || null,
    lat: lead?.lat ?? null, lng: lead?.lng ?? null,
    money, moneyKind,
    contact: lead?.contact ?? null, next: lead?.next_step ?? null, sent: lead?.sent ?? null, notes: lead?.notes ?? null,
  };
}

export interface Money { made: number; closed: number; tryingToClose: number; earlyLeads: number; pipeline: number; tourCosts: number; pl: number; counts: Record<Stage, number> }

export function money(cards: Card[], costs: TourCost[]): Money {
  const counts = Object.fromEntries(STAGES.map((s) => [s.key, 0])) as Record<Stage, number>;
  let made = 0, closed = 0, trying = 0, early = 0;
  for (const c of cards) {
    counts[c.stage]++;
    const v = c.money ?? 0;
    if (c.stage === 'settled') made += v;
    else if (c.stage === 'confirmed') closed += v;
    else if (c.stage === 'talking' || c.stage === 'hold' || c.stage === 'offer_sent') trying += v;
    else if (c.stage === 'lead' || c.stage === 'contacted') early += v;
  }
  const tourCosts = costs.reduce((s, c) => s + n(c.amount), 0);
  return { made, closed, tryingToClose: trying, earlyLeads: early, pipeline: trying + early, tourCosts, pl: made - tourCosts, counts };
}

/** Dated, not dead, in date order — the route. */
export function route(cards: Card[]): Card[] {
  return cards.filter((c) => c.date && c.stage !== 'dead').sort((a, b) => (a.date! < b.date! ? -1 : 1));
}

export function nextShow(cards: Card[]): Card | null {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return route(cards).find((c) => { const d = parseLocalDate(c.date!); return c.stage !== 'settled' && d && d >= today; }) ?? null;
}

// ───────── geocoding (Open-Meteo, free, no key) ─────────
const US: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico',
};

/** "Kansas City, MO" → { city, region }. */
export function splitCity(raw: string): { city: string; region: string | null } {
  const [c, r] = raw.split(',').map((s) => s.trim());
  return { city: c || raw.trim(), region: r || null };
}

const memo = new Map<string, { lat: number; lng: number } | null>();
export async function geocode(city: string, region: string | null, country = 'US'): Promise<{ lat: number; lng: number } | null> {
  const key = `${city}|${region ?? ''}|${country}`.toLowerCase();
  if (memo.has(key)) return memo.get(key)!;
  try {
    const cached = localStorage.getItem(`geo:${key}`);
    if (cached) { const v = JSON.parse(cached); memo.set(key, v); return v; }
  } catch { /* ignore */ }
  if (!city) return null;
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json${country ? `&countryCode=${encodeURIComponent(country)}` : ''}`;
    const r = await fetch(url);
    const j = await r.json();
    const results: any[] = j?.results || [];
    const want = region ? (US[region.toUpperCase()] || region).toLowerCase() : null;
    const hit = (want && results.find((x) => String(x.admin1 || '').toLowerCase() === want)) || results[0];
    const v = hit ? { lat: Number(hit.latitude), lng: Number(hit.longitude) } : null;
    memo.set(key, v);
    try { localStorage.setItem(`geo:${key}`, JSON.stringify(v)); } catch { /* ignore */ }
    return v;
  } catch {
    return null;
  }
}

export const money$ = (v: number) => (v < 0 ? '-' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US');
export const short$ = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  return a >= 1_000_000 ? `${s}$${(a / 1e6).toFixed(1)}M` : a >= 10_000 ? `${s}$${Math.round(a / 1000)}K` : a >= 1000 ? `${s}$${(a / 1000).toFixed(1)}K` : `${s}$${Math.round(a)}`;
};

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
export type LeadStage = 'lead' | 'contacted' | 'talking' | 'hold' | 'confirmed' | 'dead';

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
export const LEAD_STAGES: LeadStage[] = ['lead', 'contacted', 'talking', 'hold', 'confirmed', 'dead'];
/** Real shows: confirmed by the venue (with or without paper), offer out, or played. */
export const BOOKED: Stage[] = ['offer_sent', 'confirmed', 'settled'];
export const isBooked = (s: Stage) => BOOKED.includes(s);

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
  // A saved venue knows its city best; then the offer's own address; then "Venue, City".
  const v = offer?.venue;
  if (v?.city) return { city: String(v.city).trim(), region: v.state || null };
  const c = String(offer?.venue_city || '').replace(/^[\s,]+|[\s,]+$/g, '');
  if (c) return { city: c, region: offer?.venue_state?.trim() || v?.state || null };
  const after = String(offer?.show?.venue_name || '').split(',').slice(1).join(',').trim();
  return { city: after || '', region: offer?.venue_state?.trim() || v?.state || null };
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
    lat: lead?.lat ?? offer?.venue?.lat ?? null, lng: lead?.lng ?? offer?.venue?.lng ?? null,
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

/** Dated, not dead, in date order. `bookedOnly` keeps the real shows (the route line). */
export function route(cards: Card[], bookedOnly = false): Card[] {
  const dated = cards.filter((c) => c.date && c.stage !== 'dead');
  const booked = bookedOnly ? dated.filter((c) => isBooked(c.stage)) : dated;
  return booked.sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : a.city.localeCompare(b.city)));
}

/** The next show: the next booked one if there is any, otherwise the next date on the board. */
export function nextShow(cards: Card[]): Card | null {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = (list: Card[]) => list.find((c) => { const d = parseLocalDate(c.date!); return c.stage !== 'settled' && d && d >= today; }) ?? null;
  return upcoming(route(cards, true)) ?? upcoming(route(cards));
}

/** Last booked show that already happened (what the globe lands on when nothing is coming up). */
export function lastShow(cards: Card[]): Card | null {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const past = route(cards, true).filter((c) => { const d = parseLocalDate(c.date!); return d && d < today; });
  return past[past.length - 1] ?? route(cards)[0] ?? null;
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

const MX: Record<string, string> = {
  CDMX: 'Mexico City', NL: 'Nuevo León', JAL: 'Jalisco', JA: 'Jalisco', BC: 'Baja California', CHIH: 'Chihuahua', COAH: 'Coahuila', SON: 'Sonora',
  TAMPS: 'Tamaulipas', GTO: 'Guanajuato', QRO: 'Querétaro', PUE: 'Puebla', VER: 'Veracruz', YUC: 'Yucatán', QROO: 'Quintana Roo', SLP: 'San Luis Potosí',
  MICH: 'Michoacán', OAX: 'Oaxaca', GRO: 'Guerrero', SIN: 'Sinaloa', DGO: 'Durango', ZAC: 'Zacatecas', AGS: 'Aguascalientes', MEX: 'México',
};
const NICK: Record<string, string> = { stl: 'St. Louis', kc: 'Kansas City', kcmo: 'Kansas City', nyc: 'New York', la: 'Los Angeles', slc: 'Salt Lake City', atl: 'Atlanta', chi: 'Chicago', okc: 'Oklahoma City', cdmx: 'Mexico City' };

/** Ways people write a city: "saint louis " → also try "St. Louis". */
function cityVariants(raw: string): string[] {
  const c = raw.replace(/^[\s,]+|[\s,]+$/g, '').replace(/\s+/g, ' ');
  const out: string[] = [];
  if (NICK[c.toLowerCase()]) out.push(NICK[c.toLowerCase()]);
  // The proper spelling first — "saint louis" on its own finds a Saint Louis in Michigan.
  if (/^saint\s/i.test(c)) out.push(c.replace(/^saint\s/i, 'St. '));
  if (/^east saint\s/i.test(c)) out.push(c.replace(/^east saint\s/i, 'East St. '));
  out.push(c);
  if (/^st\.?\s/i.test(c)) out.push(c.replace(/^st\.?\s/i, 'Saint '));
  return [...new Set(out.filter(Boolean))];
}

/** "saint louis", "STL", "St Louis" → "St. Louis": one spelling per city for labels. */
export function canonicalCity(raw: string): string {
  const c = (raw || '').replace(/^[\s,]+|[\s,]+$/g, '').replace(/\s+/g, ' ');
  if (NICK[c.toLowerCase()]) return NICK[c.toLowerCase()];
  return c.replace(/^saint\s/i, 'St. ').replace(/^st\s/i, 'St. ').replace(/^east saint\s/i, 'East St. ')
    .split(' ').map((w) => (w.length > 2 && w === w.toLowerCase()) || w === w.toUpperCase() ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w).join(' ');
}

const memo = new Map<string, { lat: number; lng: number } | null>();
export async function geocode(city: string, region: string | null, country?: string): Promise<{ lat: number; lng: number } | null> {
  const reg = (region || '').trim();
  const R = reg.toUpperCase().replace(/\./g, '');
  const usState = US[R] || Object.values(US).find((n) => n.toLowerCase() === reg.toLowerCase());
  const mxState = MX[R];
  const cc = country || (usState ? 'US' : mxState ? 'MX' : '');
  const key = `${city}|${reg}|${cc}`.toLowerCase().trim();
  if (memo.has(key)) return memo.get(key)!;
  try {
    const cached = localStorage.getItem(`geo2:${key}`);
    if (cached) { const v = JSON.parse(cached); memo.set(key, v); return v; }
  } catch { /* ignore */ }
  if (!city.trim()) return null;
  const want = (usState || mxState || reg).toLowerCase();
  let v: { lat: number; lng: number } | null = null;
  try {
    for (const name of cityVariants(city)) {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=en&format=json${cc ? `&countryCode=${cc}` : ''}`;
      const j = await (await fetch(url)).json();
      const results: any[] = j?.results || [];
      // With a state given, only a result in that state counts; a wrong-state hit is worse than none.
      const hit = want ? results.find((x) => String(x.admin1 || '').toLowerCase() === want) : results[0];
      if (hit) { v = { lat: Number(hit.latitude), lng: Number(hit.longitude) }; break; }
    }
  } catch {
    return null; // offline: try again next time
  }
  memo.set(key, v);
  // Only remember hits; a miss may be a typo the promoter fixes in a minute.
  if (v) { try { localStorage.setItem(`geo2:${key}`, JSON.stringify(v)); } catch { /* ignore */ } }
  return v;
}

export const money$ = (v: number) => (v < 0 ? '-' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US');
export const short$ = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  return a >= 1_000_000 ? `${s}$${(a / 1e6).toFixed(1)}M` : a >= 10_000 ? `${s}$${Math.round(a / 1000)}K` : a >= 1000 ? `${s}$${(a / 1000).toFixed(1)}K` : `${s}$${Math.round(a)}`;
};

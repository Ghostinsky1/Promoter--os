// PromoterOS MCP server — Supabase Edge Function.
// Each request carries the promoter's own Supabase OAuth token, so every query
// runs through Row Level Security: a user can only ever touch their own org's data.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  analyze, artistCost, calculateOffer, dealSummary, DEFAULT_EXPENSES, settlementActuals, totalExpenses,
} from "./calc.ts";
// Same PDF code the app uses, bundled for Deno (rebuild: npm run build:mcp-pdf).
import { offerPdfBase64, artistSheetBase64, offerPDFFilename } from "./pdf-bundle.js";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PDF_BUCKET = "offer-pdfs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// Public publishable key (same one baked into the frontend).
const ANON_KEY = "sb_publishable__Z7PaYKUMaj4zNIgK2bb4w_1TdSSQ-3";
const FN = "promtp-mcp";
const PUBLIC_BASE = SUPABASE_URL.replace(/^http:/, "https:");
const RESOURCE = `${PUBLIC_BASE}/functions/v1/${FN}`;
const RESOURCE_METADATA = `${RESOURCE}/.well-known/oauth-protected-resource`;
const AUTH_SERVER = `${PUBLIC_BASE}/auth/v1`;
const APP_URL = "https://promoteros.com";
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id, accept",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", ...extra } });

// deno-lint-ignore no-explicit-any
type Any = any;
class UserError extends Error {}

// ---------- context ----------
interface Ctx {
  db: SupabaseClient;
  token: string;
  userId: string;
  email?: string;
  org: Any;
}

async function loadCtx(token: string): Promise<Ctx | null> {
  try {
    return await loadCtxInner(token);
  } catch (e) {
    console.warn("auth failed", (e as Error).message);
    return null;
  }
}

async function loadCtxInner(token: string): Promise<Ctx | null> {
  const db = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: mem } = await db
    .from("organization_members")
    .select("organization_id, role, organizations(*)")
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return { db, token, userId: data.user.id, email: data.user.email, org: (mem as Any)?.organizations ?? null };
}

function hasAccess(org: Any): boolean {
  if (!org) return false;
  if (org.subscription_status === "active") return true;
  if (org.subscription_status === "trialing") {
    return !org.trial_ends_at || new Date(org.trial_ends_at) > new Date();
  }
  return false;
}

// The AI connector is a Pro and Agency Scale feature. Keep this list in sync with
// src/lib/subscriptionTiers.ts (AI_CONNECTOR_TIERS).
const AI_CONNECTOR_TIERS = new Set(["pro", "agency_scale"]);

function canUseConnector(org: Any): boolean {
  return AI_CONNECTOR_TIERS.has(String(org?.subscription_tier ?? "").toLowerCase());
}

function requireAccess(ctx: Ctx) {
  if (!ctx.org) throw new UserError(`This account isn't part of a PromoterOS organization yet. Finish signup at ${APP_URL}.`);
  if (!hasAccess(ctx.org)) {
    throw new UserError(`The PromoterOS subscription for "${ctx.org.name}" is not active (status: ${ctx.org.subscription_status}). Subscribe at ${APP_URL}/pricing to keep using PromoterOS in Claude.`);
  }
  if (!canUseConnector(ctx.org)) {
    throw new UserError(`The AI connector is part of the Pro and Agency Scale plans. "${ctx.org.name}" is on the Starter plan, so this connection can read and change nothing. Upgrade at ${APP_URL}/pricing and reconnect.`);
  }
}

const must = <T>(r: { data: T; error: Any }, what: string): T => {
  if (r.error) throw new UserError(`${what}: ${r.error.message}`);
  return r.data;
};

async function getOfferRow(ctx: Ctx, id: string) {
  const offer = must(await ctx.db.from("offers").select("*").eq("id", id).maybeSingle(), "Loading offer");
  if (!offer) throw new UserError(`No offer found with id "${id}". Use list_offers to find the right id.`);
  const show = must(await ctx.db.from("shows").select("*").eq("id", (offer as Any).show_id).maybeSingle(), "Loading show");
  return { offer: offer as Any, show: show as Any };
}


// ---------- PDF + email helpers ----------
async function loadCompanySettings(ctx: Ctx): Promise<Any> {
  const { data } = await ctx.db.from("company_settings").select("*").eq("organization_id", ctx.org.id).limit(1).maybeSingle();
  return data || null;
}

function buildOfferPdf(offer: Any, show: Any, cs: Any, mode: "artist_offer" | "estimate", costsOnly = false) {
  const full = { ...offer, show };
  return { filename: offerPDFFilename(full), base64: offerPdfBase64(full, cs, mode, costsOnly) as string };
}

async function storePdf(ctx: Ctx, filename: string, base64: string): Promise<{ path: string; url: string; expires_in_hours: number }> {
  if (!SERVICE_ROLE_KEY) throw new UserError("PDF storage is not configured on the server.");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((b: Any) => b.name === PDF_BUCKET)) {
    await admin.storage.createBucket(PDF_BUCKET, { public: false, fileSizeLimit: 10 * 1024 * 1024 });
  }
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const path = `${ctx.org.id}/${Date.now()}-${filename}`;
  const up = await admin.storage.from(PDF_BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error(`Storing PDF: ${up.error.message}`);
  const hours = 24;
  const signed = await admin.storage.from(PDF_BUCKET).createSignedUrl(path, hours * 3600);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`Creating download link: ${signed.error?.message}`);
  return { path, url: signed.data.signedUrl, expires_in_hours: hours };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fmtLongDate(iso: string) {
  const [y, m, d] = String(iso || "").slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso || "";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

const money = (v: number) => Math.round((v ?? 0) * 100) / 100;
function roundAll(o: Any): Any {
  if (typeof o === "number") return Number.isFinite(o) ? money(o) : o;
  if (Array.isArray(o)) return o.map(roundAll);
  if (o && typeof o === "object") return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, roundAll(v)]));
  return o;
}

function summarize(offer: Any, show: Any) {
  const c = offer.calculations || {};
  return {
    offer_id: offer.id,
    event_name: show?.event_name ?? null,
    artist: show?.artist_name,
    venue: show?.venue_name,
    city: [offer.venue_city, offer.venue_state].filter(Boolean).join(", ") || null,
    event_date: show?.event_date,
    capacity: show?.capacity,
    status: offer.status,
    deal_type: offer.deal_type,
    guarantee: money(offer.guarantee),
    gross_potential: money(c.grossPotential),
    projected_net_profit: money(c.netProfit),
    ...(offer.deal_type && offer.deal_type !== "flat_fee"
      ? {
        promoter_profit_under_deal_terms: money(dealSummary(offer).promoter_profit),
        profit_note: "projected_net_profit is the app's stored estimate (treats the artist as paid the guarantee); promoter_profit_under_deal_terms applies the percentage split.",
      }
      : {}),
    link: `${APP_URL}/offers/${offer.id}`,
  };
}

// ---------- input helpers ----------
const OFFER_FIELDS = [
  "mode", "status", "deal_type", "guarantee", "artist_percentage", "tax_withholding_pct", "deposit_pct",
  "artist_backend_pct", "promoter_backend_pct", "deposit_due_timing", "deposit_due_date", "artist_deposit_status",
  "balance_due_timing", "custom_balance_due_date", "venue_deposit", "venue_deposit_due_date", "venue_deposit_status",
  "venue_street", "venue_city", "venue_state", "venue_zip", "ticket_tiers", "sales_tax_pct", "support_acts",
  "facility_fee_per_ticket", "comps_artist", "comps_venue", "comps_promoter", "doors_time", "show_time",
  "curfew_time", "age_limit", "merch_rate_soft", "merch_rate_hard", "include_hotel", "hotel_budget", "hotel_nights",
  "hotel_notes", "include_transport", "transport_budget", "transport_notes", "include_flights", "flight_budget",
  "flight_notes", "include_rider", "rider_cap", "rider_notes", "payment_method", "settlement_days",
  "full_payment_due_date", "offer_expires_at", "tour_id",
];
const SHOW_FIELDS = ["artist_name", "venue_name", "event_date", "capacity", "event_name"];

function normalizeTiers(tiers: Any): Any[] {
  if (!Array.isArray(tiers)) throw new UserError("ticket_tiers must be a list.");
  return tiers.map((t: Any) => ({
    type: String(t.type ?? t.name ?? "GA"),
    allotment: Number(t.allotment ?? t.quantity ?? 0),
    comps: Number(t.comps ?? 0),
    price: Number(t.price ?? 0),
    ...(t.actualSold !== undefined ? { actualSold: Number(t.actualSold) } : {}),
  }));
}

function mergeExpenses(base: Any, patch: Any): Any {
  const out: Any = JSON.parse(JSON.stringify(base || DEFAULT_EXPENSES));
  for (const [cat, items] of Object.entries(patch || {})) {
    out[cat] = { ...(out[cat] || {}), ...(items as Any) };
  }
  return out;
}

function fullAddress(o: Any) {
  return [o.venue_street, `${o.venue_city || ""}${o.venue_state ? ", " + o.venue_state : ""}${o.venue_zip ? " " + o.venue_zip : ""}`]
    .filter((s) => s && s.trim()).join("\n");
}

// ---------- schemas ----------
const tierSchema = {
  type: "array",
  description: "Ticket tiers. Each: type (e.g. 'GA', 'VIP', 'Early Bird'), allotment (tickets available), comps (free tickets in that tier), price (USD).",
  items: {
    type: "object",
    properties: { type: { type: "string" }, allotment: { type: "number" }, comps: { type: "number" }, price: { type: "number" } },
    required: ["type", "allotment", "price"],
  },
};
const expensesSchema = {
  type: "object",
  description: "Fixed expenses grouped by category → {line_item: amount}. Categories used by the app: talent, general, marketing, production. Example: {\"marketing\": {\"paid_social\": 1500}, \"general\": {\"security\": 800}}. New line items are allowed.",
  additionalProperties: { type: "object", additionalProperties: { type: "number" } },
};
const dealTypeSchema = {
  type: "string",
  enum: ["flat_fee", "guarantee_vs_percentage", "percentage_only", "door_deal"],
  description: "flat_fee = artist gets the guarantee. guarantee_vs_percentage = artist gets the higher of guarantee or artist_percentage of net. percentage_only / door_deal = artist gets artist_percentage of net.",
};
const statusSchema = { type: "string", enum: ["planning", "offer_sent", "confirmed", "active", "settled", "cancelled"] };
const offerEditProps = {
  event_name: { type: "string" },
  artist_name: { type: "string" },
  venue_name: { type: "string" },
  event_date: { type: "string", description: "YYYY-MM-DD" },
  capacity: { type: "integer" },
  status: statusSchema,
  deal_type: dealTypeSchema,
  guarantee: { type: "number", description: "Artist guarantee in USD" },
  artist_percentage: { type: "number", description: "Artist % of net (for percentage deals)" },
  deposit_pct: { type: "number", description: "Artist deposit as % of guarantee" },
  deposit_due_date: { type: "string" },
  tax_withholding_pct: { type: "number" },
  sales_tax_pct: { type: "number", description: "Sales/ticket tax %, app default 13.18" },
  ticket_tiers: tierSchema,
  expenses: expensesSchema,
  venue_street: { type: "string" }, venue_city: { type: "string" }, venue_state: { type: "string" }, venue_zip: { type: "string" },
  venue_deposit: { type: "number" }, venue_deposit_due_date: { type: "string" },
  venue_deposit_status: { type: "string", enum: ["pending", "paid", "refunded"] },
  artist_deposit_status: { type: "string" },
  payment_method: { type: "string", enum: ["deposit_balance", "full_upfront", "day_of_settlement"] },
  doors_time: { type: "string", description: "HH:MM" }, show_time: { type: "string" }, curfew_time: { type: "string" },
  age_limit: { type: "string", description: "e.g. 'All Ages', '18+', '21+'" },
  include_hotel: { type: "boolean" }, hotel_budget: { type: "number", description: "Per night" }, hotel_nights: { type: "integer" },
  include_flights: { type: "boolean" }, flight_budget: { type: "number" },
  include_transport: { type: "boolean" }, transport_budget: { type: "number" },
  include_rider: { type: "boolean" }, rider_cap: { type: "number" },
  facility_fee_per_ticket: { type: "number" },
};

const RO = { readOnlyHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const DESTROY = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Any;
  annotations: Any;
  run: (ctx: Ctx, a: Any) => Promise<unknown>;
}

// ---------- tools ----------
const tools: Tool[] = [
  {
    name: "get_account",
    title: "Get PromoterOS account",
    description: "Shows who is signed in, their organization, plan, subscription status and offer limit.",
    inputSchema: { type: "object", properties: {} },
    annotations: RO,
    run: async (ctx) => {
      const o = ctx.org;
      const count = o
        ? (await ctx.db.from("offers").select("id", { count: "exact", head: true }).neq("status", "cancelled")).count
        : 0;
      return {
        email: ctx.email,
        organization: o?.name ?? null,
        plan: o?.subscription_tier ?? null,
        subscription_status: o?.subscription_status ?? null,
        trial_ends_at: o?.trial_ends_at ?? null,
        has_access: hasAccess(o),
        can_use_ai_connector: canUseConnector(o),
        ai_connector_note: canUseConnector(o)
          ? null
          : "The AI connector is part of the Pro and Agency Scale plans. On Starter, this connection can't read or change anything.",
        active_offers: count,
        max_offers: o?.max_offers === -1 ? "unlimited" : o?.max_offers,
      };
    },
  },
  {
    name: "list_offers",
    title: "List offers",
    description: "Lists the organization's show offers with artist, venue, date, status, guarantee and projected profit. Use this first to find an offer_id.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Match artist, venue or event name" },
        status: statusSchema,
        upcoming_only: { type: "boolean", description: "Only shows today or later" },
        limit: { type: "integer", default: 25, maximum: 100 },
      },
    },
    annotations: RO,
    run: async (ctx, a) => {
      requireAccess(ctx);
      let q = ctx.db.from("offers").select("*").order("created_at", { ascending: false }).limit(500);
      if (a.status) q = q.eq("status", a.status);
      const offers = must(await q, "Listing offers") as Any[];
      const ids = [...new Set(offers.map((o) => o.show_id))];
      const shows = ids.length ? must(await ctx.db.from("shows").select("*").in("id", ids), "Listing shows") as Any[] : [];
      const byId = new Map(shows.map((s) => [s.id, s]));
      const today = new Date().toISOString().slice(0, 10);
      const s = (a.search || "").toLowerCase();
      let rows = offers.map((o) => summarize(o, byId.get(o.show_id)));
      if (s) rows = rows.filter((r) => [r.artist, r.venue, r.event_name].some((x) => (x || "").toLowerCase().includes(s)));
      if (a.upcoming_only) rows = rows.filter((r) => (r.event_date || "") >= today);
      rows.sort((x, y) => (x.event_date || "").localeCompare(y.event_date || ""));
      return { count: rows.length, offers: rows.slice(0, Math.min(a.limit || 25, 100)) };
    },
  },
  {
    name: "get_offer",
    title: "Get offer details",
    description: "Full details for one offer: deal terms, ticket tiers, expenses, calculated numbers, deposits, lineup artists, tasks, notes, run of show and settlement (if any).",
    inputSchema: { type: "object", properties: { offer_id: { type: "string" } }, required: ["offer_id"] },
    annotations: RO,
    run: async (ctx, a) => {
      requireAccess(ctx);
      const { offer, show } = await getOfferRow(ctx, a.offer_id);
      const id = offer.id;
      const [tasks, notes, artists, deposits, ros, settlement] = await Promise.all([
        ctx.db.from("offer_tasks").select("*").eq("offer_id", id).order("created_at"),
        ctx.db.from("offer_notes").select("*").eq("offer_id", id).maybeSingle(),
        ctx.db.from("event_artists").select("*").eq("offer_id", id).order("sort_order"),
        ctx.db.from("offer_deposits").select("*").eq("offer_id", id).order("due_date"),
        ctx.db.from("run_of_show").select("*").eq("offer_id", id).maybeSingle(),
        ctx.db.from("settlements").select("*").eq("offer_id", id).maybeSingle(),
      ]);
      const { calculations, ...rest } = offer;
      return roundAll({
        summary: summarize(offer, show),
        show,
        terms: rest,
        calculations,
        deal_summary: dealSummary(offer),
        lineup: (artists.data || []).map((x: Any) => ({ ...x, cost_breakdown: artistCost(x) })),
        deposits: deposits.data || [],
        tasks: tasks.data || [],
        notes: notes.data || null,
        run_of_show: ros.data || null,
        settlement: settlement.data || null,
      });
    },
  },
  {
    name: "create_offer",
    title: "Create offer",
    description: "Creates a new show + offer in PromoterOS (same as the Create Offer screen). Anything not given uses the app's defaults. Numbers are calculated automatically. Returns the new offer_id and link.",
    inputSchema: {
      type: "object",
      properties: { ...offerEditProps },
      required: ["artist_name", "venue_name", "event_date", "capacity"],
    },
    annotations: WRITE,
    run: async (ctx, a) => {
      requireAccess(ctx);
      const org = ctx.org;
      if (org.max_offers !== -1) {
        const { count } = await ctx.db.from("offers").select("id", { count: "exact", head: true }).neq("status", "cancelled");
        if ((count || 0) >= org.max_offers) {
          throw new UserError(`Offer limit reached (${count}/${org.max_offers}). Upgrade at ${APP_URL}/pricing for unlimited offers.`);
        }
      }
      if (!(Number(a.capacity) > 0)) throw new UserError("capacity must be greater than 0.");
      const stamp = Date.now();
      const showId = `show_${stamp}`;
      const offerId = `offer_${stamp}`;
      const offer: Any = {
        id: offerId, show_id: showId, mode: "estimate", status: "planning", deal_type: "flat_fee",
        guarantee: 0, artist_percentage: 100, tax_withholding_pct: 2, deposit_pct: 20,
        artist_backend_pct: 85, promoter_backend_pct: 15, deposit_due_timing: "30_days_before",
        sales_tax_pct: 13.18, ticket_tiers: [{ type: "GA", allotment: 0, comps: 0, price: 0 }],
        expenses: DEFAULT_EXPENSES, support_acts: [], artist_deductions: [],
        ascap_rate: 0.0023, bmi_rate: 0.003, sesac_rate: 0.000214, insurance_per_attendee: 0.62, cc_fee_rate: 0.012,
        payment_method: "deposit_balance", settlement_days: 7, age_limit: "All Ages",
        offer_sent_date: new Date().toISOString().slice(0, 10),
        user_id: ctx.userId, organization_id: org.id,
      };
      for (const k of OFFER_FIELDS) if (a[k] !== undefined && k !== "expenses") offer[k] = a[k];
      if (a.ticket_tiers) offer.ticket_tiers = normalizeTiers(a.ticket_tiers);
      if (a.expenses) offer.expenses = mergeExpenses(DEFAULT_EXPENSES, a.expenses);
      offer.venue_full_address = fullAddress(offer);
      offer.calculations = calculateOffer(offer);

      must(await ctx.db.from("shows").insert({
        id: showId, event_name: a.event_name ?? null, artist_name: a.artist_name, venue_name: a.venue_name,
        event_date: a.event_date, capacity: a.capacity, user_id: ctx.userId, organization_id: org.id,
      }), "Creating show");
      const ins = await ctx.db.from("offers").insert(offer);
      if (ins.error) {
        await ctx.db.from("shows").delete().eq("id", showId);
        throw new UserError(`Creating offer: ${ins.error.message}`);
      }
      return roundAll({ created: true, ...summarize(offer, { ...a, id: showId }), calculations: offer.calculations, deal_summary: dealSummary(offer) });
    },
  },
  {
    name: "update_offer",
    title: "Update offer",
    description: "Edits an existing offer: deal terms, status, show details, ticket tiers (replaces the full list), or expenses (merged — only the line items you pass change; set an item to 0 to clear it). Numbers are recalculated automatically.",
    inputSchema: {
      type: "object",
      properties: { offer_id: { type: "string" }, ...offerEditProps },
      required: ["offer_id"],
    },
    annotations: WRITE,
    run: async (ctx, a) => {
      requireAccess(ctx);
      const { offer, show } = await getOfferRow(ctx, a.offer_id);
      const patch: Any = {};
      for (const k of OFFER_FIELDS) if (a[k] !== undefined && k !== "expenses" && k !== "ticket_tiers") patch[k] = a[k];
      if (a.ticket_tiers) patch.ticket_tiers = normalizeTiers(a.ticket_tiers);
      if (a.expenses) patch.expenses = mergeExpenses(offer.expenses, a.expenses);
      const merged = { ...offer, ...patch };
      if (["venue_street", "venue_city", "venue_state", "venue_zip"].some((k) => a[k] !== undefined)) {
        patch.venue_full_address = fullAddress(merged);
      }
      patch.calculations = calculateOffer(merged);
      const showPatch: Any = {};
      for (const k of SHOW_FIELDS) if (a[k] !== undefined) showPatch[k] = a[k];
      if (Object.keys(showPatch).length) must(await ctx.db.from("shows").update(showPatch).eq("id", offer.show_id), "Updating show");
      must(await ctx.db.from("offers").update(patch).eq("id", offer.id), "Updating offer");
      const changed = [...Object.keys(patch).filter((k) => k !== "calculations"), ...Object.keys(showPatch)];
      return roundAll({
        updated: true, changed_fields: changed,
        ...summarize({ ...merged, calculations: patch.calculations }, { ...show, ...showPatch }),
        deal_summary: dealSummary(merged),
      });
    },
  },
  {
    name: "calculate_deal",
    title: "Calculate a deal (what-if)",
    description: "Runs PromoterOS deal math on hypothetical numbers WITHOUT saving anything: gross, taxes, expenses, artist payout, promoter profit, 70/85/100% sell-through, break-even and risk. Pass offer_id to start from an existing offer and override some numbers.",
    inputSchema: {
      type: "object",
      properties: {
        offer_id: { type: "string", description: "Optional: start from this offer's saved terms" },
        event_date: { type: "string" },
        deal_type: dealTypeSchema,
        guarantee: { type: "number" },
        artist_percentage: { type: "number" },
        deposit_pct: { type: "number" },
        sales_tax_pct: { type: "number" },
        tax_withholding_pct: { type: "number" },
        ticket_tiers: tierSchema,
        expenses: expensesSchema,
        venue_deposit: { type: "number" },
        include_hotel: { type: "boolean" }, hotel_budget: { type: "number" }, hotel_nights: { type: "integer" },
        include_flights: { type: "boolean" }, flight_budget: { type: "number" },
        include_transport: { type: "boolean" }, transport_budget: { type: "number" },
        include_rider: { type: "boolean" }, rider_cap: { type: "number" },
      },
    },
    annotations: RO,
    run: async (ctx, a) => {
      requireAccess(ctx);
      let base: Any = {
        deal_type: "flat_fee", guarantee: 0, artist_percentage: 100, deposit_pct: 20, sales_tax_pct: 13.18,
        tax_withholding_pct: 2, ticket_tiers: [], expenses: DEFAULT_EXPENSES, support_acts: [],
      };
      let eventDate = a.event_date;
      if (a.offer_id) {
        const { offer, show } = await getOfferRow(ctx, a.offer_id);
        base = offer;
        eventDate = eventDate ?? show?.event_date;
      }
      const o: Any = { ...base };
      for (const k of Object.keys(a)) if (!["offer_id", "event_date", "expenses", "ticket_tiers"].includes(k)) o[k] = a[k];
      if (a.ticket_tiers) o.ticket_tiers = normalizeTiers(a.ticket_tiers);
      if (a.expenses) o.expenses = a.offer_id ? mergeExpenses(base.expenses, a.expenses) : mergeExpenses({}, a.expenses);
      o.calculations = calculateOffer(o);
      return roundAll({
        saved: false,
        fixed_expenses_entered: totalExpenses(o.expenses),
        calculations: o.calculations,
        deal_summary: dealSummary(o),
        analysis: analyze(o, eventDate),
      });
    },
  },
  {
    name: "analyze_offer",
    title: "Analyze offer risk",
    description: "Deal Analyzer for a saved offer: break-even tickets and %, profit at 50/70/85/100% sold, cash needed upfront, days out, and a 0–100 risk score.",
    inputSchema: { type: "object", properties: { offer_id: { type: "string" } }, required: ["offer_id"] },
    annotations: RO,
    run: async (ctx, a) => {
      requireAccess(ctx);
      const { offer, show } = await getOfferRow(ctx, a.offer_id);
      return roundAll({ ...summarize(offer, show), deal_summary: dealSummary(offer), analysis: analyze(offer, show?.event_date) });
    },
  },
  {
    name: "preview_settlement",
    title: "Preview settlement",
    description: "Settlement math for a show using actual tickets sold and actual expenses: actual revenue, expenses, profit, and variance vs. the estimate. Set save=true to save it as the offer's settlement and mark the offer settled.",
    inputSchema: {
      type: "object",
      properties: {
        offer_id: { type: "string" },
        actual_sold: {
          type: "object", additionalProperties: { type: "number" },
          description: "Tickets actually sold per tier type, e.g. {\"GA\": 412, \"VIP\": 38}. Tiers left out count as 0 (or keep the saved value if a settlement exists).",
        },
        actual_expenses: { ...expensesSchema, description: "Actual expenses by category → {line_item: amount}. Merged over any saved settlement." },
        notes: { type: "string" },
        save: { type: "boolean", default: false },
      },
      required: ["offer_id"],
    },
    annotations: WRITE,
    run: async (ctx, a) => {
      requireAccess(ctx);
      const { offer, show } = await getOfferRow(ctx, a.offer_id);
      const existing = must(await ctx.db.from("settlements").select("*").eq("offer_id", offer.id).maybeSingle(), "Loading settlement") as Any;
      const prevSold = new Map((existing?.actual_attendance || []).map((t: Any) => [t.type, t.actual_sold]));
      const attendance = (offer.ticket_tiers || []).map((t: Any) => ({
        type: t.type, price: Number(t.price),
        actual_sold: Number(a.actual_sold?.[t.type] ?? prevSold.get(t.type) ?? 0),
        projected_sold: Number(t.allotment) - Number(t.comps),
      }));
      const unknown = Object.keys(a.actual_sold || {}).filter((k) => !attendance.some((t: Any) => t.type === k));
      if (unknown.length) {
        throw new UserError(`Unknown ticket tier(s): ${unknown.join(", ")}. This offer's tiers are: ${attendance.map((t: Any) => t.type).join(", ")}.`);
      }
      const expenses = mergeExpenses(existing?.actual_expenses && Object.keys(existing.actual_expenses).length ? existing.actual_expenses : {}, a.actual_expenses || {});
      const result = settlementActuals(offer, attendance, expenses);
      const row: Any = {
        offer_id: offer.id, actual_attendance: attendance, actual_expenses: expenses, ...result,
        notes: a.notes ?? existing?.notes ?? "", organization_id: ctx.org.id, user_id: ctx.userId,
        settled_at: new Date().toISOString(),
      };
      if (a.save) {
        if (existing?.id) must(await ctx.db.from("settlements").update(row).eq("id", existing.id), "Saving settlement");
        else must(await ctx.db.from("settlements").insert(row), "Saving settlement");
        must(await ctx.db.from("offers").update({
          is_settled: true, status: "settled", actual_profit: result.actual_profit,
        }).eq("id", offer.id), "Marking offer settled");
      }
      return roundAll({
        saved: !!a.save, ...summarize(offer, show),
        tickets_sold: attendance.reduce((s: number, t: Any) => s + t.actual_sold, 0),
        attendance, actual_expenses: expenses, ...result,
        link: `${APP_URL}/offers/${offer.id}/settlement`,
      });
    },
  },
  {
    name: "add_lineup_artist",
    title: "Add artist to lineup",
    description: "Adds an artist (headliner, support, opener, etc.) to an offer's lineup with their guarantee, deposit, travel and hospitality terms.",
    inputSchema: {
      type: "object",
      properties: {
        offer_id: { type: "string" },
        artist_name: { type: "string" },
        role: { type: "string", description: "e.g. headliner, support, local_opener, special_guest" },
        guarantee: { type: "number" },
        deposit_type: { type: "string", enum: ["percentage", "fixed"] },
        deposit_percentage: { type: "number" },
        deposit_amount: { type: "number" },
        agency: { type: "string" }, contact_name: { type: "string" }, contact_email: { type: "string" }, contact_phone: { type: "string" },
        set_length: { type: "integer", description: "Minutes" },
        performance_time: { type: "string" },
        flight_covered: { type: "boolean" }, flight_budget: { type: "number" },
        hotel_covered: { type: "boolean" }, hotel_budget: { type: "number" }, hotel_nights: { type: "integer" }, hotel_rooms: { type: "integer" },
        ground_transport_covered: { type: "boolean" }, ground_transport_budget: { type: "number" },
        hospitality_buyout: { type: "number" }, dinner_buyout: { type: "number" }, drink_tickets: { type: "integer" },
        guest_list_spots: { type: "integer" },
        special_terms: { type: "string" }, internal_notes: { type: "string" },
      },
      required: ["offer_id", "artist_name"],
    },
    annotations: WRITE,
    run: async (ctx, a) => {
      requireAccess(ctx);
      const { offer } = await getOfferRow(ctx, a.offer_id);
      const { offer_id: _o, ...fields } = a;
      const existing = must(await ctx.db.from("event_artists").select("sort_order").eq("offer_id", offer.id), "Loading lineup") as Any[];
      const row: Any = { ...fields, offer_id: offer.id, organization_id: ctx.org.id, sort_order: existing.length };
      const c = artistCost(row);
      row.balance_due = c.balance;
      row.total_artist_cost = c.total;
      const data = must(await ctx.db.from("event_artists").insert(row).select().single(), "Adding artist");
      return roundAll({ added: true, artist: data, cost_breakdown: c });
    },
  },
  {
    name: "update_lineup_artist",
    title: "Update lineup artist",
    description: "Edits an artist already on an offer's lineup (use get_offer to find the artist id). Status values used by the app include draft, offer_sent, confirmed, deposit_paid, fully_paid.",
    inputSchema: {
      type: "object",
      properties: {
        artist_id: { type: "string" },
        artist_name: { type: "string" }, role: { type: "string" }, status: { type: "string" },
        guarantee: { type: "number" }, deposit_type: { type: "string", enum: ["percentage", "fixed"] },
        deposit_percentage: { type: "number" }, deposit_amount: { type: "number" },
        set_length: { type: "integer" }, performance_time: { type: "string" }, soundcheck_time: { type: "string" },
        flight_covered: { type: "boolean" }, flight_budget: { type: "number" },
        hotel_covered: { type: "boolean" }, hotel_budget: { type: "number" }, hotel_nights: { type: "integer" },
        ground_transport_covered: { type: "boolean" }, ground_transport_budget: { type: "number" },
        hospitality_buyout: { type: "number" }, dinner_buyout: { type: "number" },
        payment_notes: { type: "string" }, special_terms: { type: "string" }, internal_notes: { type: "string" },
      },
      required: ["artist_id"],
    },
    annotations: WRITE,
    run: async (ctx, a) => {
      requireAccess(ctx);
      const cur = must(await ctx.db.from("event_artists").select("*").eq("id", a.artist_id).maybeSingle(), "Loading artist") as Any;
      if (!cur) throw new UserError(`No lineup artist with id "${a.artist_id}".`);
      const { artist_id: _id, ...patch } = a;
      const c = artistCost({ ...cur, ...patch });
      const data = must(await ctx.db.from("event_artists").update({
        ...patch, balance_due: c.balance, total_artist_cost: c.total, updated_at: new Date().toISOString(),
      }).eq("id", a.artist_id).select().single(), "Updating artist");
      return roundAll({ updated: true, artist: data, cost_breakdown: c });
    },
  },
  {
    name: "add_task",
    title: "Add task",
    description: "Adds a to-do to an offer (e.g. 'Send contract', 'Pay artist deposit').",
    inputSchema: {
      type: "object",
      properties: {
        offer_id: { type: "string" }, title: { type: "string" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        priority: { type: "string", enum: ["low", "med", "high"] },
        owner: { type: "string" }, note: { type: "string" },
      },
      required: ["offer_id", "title"],
    },
    annotations: WRITE,
    run: async (ctx, a) => {
      requireAccess(ctx);
      const { offer } = await getOfferRow(ctx, a.offer_id);
      const data = must(await ctx.db.from("offer_tasks").insert({
        offer_id: offer.id, organization_id: ctx.org.id, title: a.title, due_date: a.due_date ?? null,
        priority: a.priority ?? "med", owner: a.owner ?? null, note: a.note ?? null,
      }).select().single(), "Adding task");
      return { added: true, task: data };
    },
  },
  {
    name: "list_tasks",
    title: "List tasks",
    description: "Lists open (or all) tasks across every offer, or for one offer, sorted by due date.",
    inputSchema: {
      type: "object",
      properties: { offer_id: { type: "string" }, include_completed: { type: "boolean", default: false } },
    },
    annotations: RO,
    run: async (ctx, a) => {
      requireAccess(ctx);
      let q = ctx.db.from("offer_tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }).limit(200);
      if (a.offer_id) q = q.eq("offer_id", a.offer_id);
      if (!a.include_completed) q = q.eq("completed", false);
      const tasks = must(await q, "Listing tasks") as Any[];
      const ids = [...new Set(tasks.map((t) => t.offer_id))];
      const offers = ids.length ? must(await ctx.db.from("offers").select("id, show_id").in("id", ids), "") as Any[] : [];
      const shows = offers.length ? must(await ctx.db.from("shows").select("id, artist_name, event_date").in("id", offers.map((o) => o.show_id)), "") as Any[] : [];
      const showOf = new Map(offers.map((o) => [o.id, shows.find((s) => s.id === o.show_id)]));
      return {
        count: tasks.length,
        tasks: tasks.map((t) => ({ ...t, artist: showOf.get(t.offer_id)?.artist_name, event_date: showOf.get(t.offer_id)?.event_date })),
      };
    },
  },
  {
    name: "update_task",
    title: "Update task",
    description: "Marks a task done/undone or changes its title, due date, priority, owner or note.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" }, completed: { type: "boolean" }, title: { type: "string" },
        due_date: { type: "string" }, priority: { type: "string", enum: ["low", "med", "high"] },
        owner: { type: "string" }, note: { type: "string" },
      },
      required: ["task_id"],
    },
    annotations: WRITE,
    run: async (ctx, a) => {
      requireAccess(ctx);
      const { task_id, ...patch } = a;
      const data = must(await ctx.db.from("offer_tasks").update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", task_id).select().maybeSingle(), "Updating task");
      if (!data) throw new UserError(`No task with id "${task_id}".`);
      return { updated: true, task: data };
    },
  },
  {
    name: "delete_task",
    title: "Delete task",
    description: "Permanently deletes a task.",
    inputSchema: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] },
    annotations: DESTROY,
    run: async (ctx, a) => {
      requireAccess(ctx);
      const data = must(await ctx.db.from("offer_tasks").delete().eq("id", a.task_id).select(), "Deleting task") as Any[];
      if (!data.length) throw new UserError(`No task with id "${a.task_id}".`);
      return { deleted: true, task: data[0] };
    },
  },
  {
    name: "add_note",
    title: "Add note",
    description: "Adds a note to an offer. pinned=true adds a pinned note; otherwise the text is appended to the offer's event notes.",
    inputSchema: {
      type: "object",
      properties: { offer_id: { type: "string" }, text: { type: "string" }, pinned: { type: "boolean", default: false } },
      required: ["offer_id", "text"],
    },
    annotations: WRITE,
    run: async (ctx, a) => {
      requireAccess(ctx);
      const { offer } = await getOfferRow(ctx, a.offer_id);
      let row = must(await ctx.db.from("offer_notes").select("*").eq("offer_id", offer.id).maybeSingle(), "Loading notes") as Any;
      if (!row) {
        row = must(await ctx.db.from("offer_notes").insert({
          offer_id: offer.id, organization_id: ctx.org.id, event_notes: "", pinned_notes: [],
        }).select().single(), "Creating notes");
      }
      const patch: Any = { updated_at: new Date().toISOString() };
      if (a.pinned) {
        patch.pinned_notes = [...(row.pinned_notes || []), { id: crypto.randomUUID(), text: a.text, createdAt: new Date().toISOString() }];
      } else {
        patch.event_notes = row.event_notes ? `${row.event_notes}\n${a.text}` : a.text;
      }
      const data = must(await ctx.db.from("offer_notes").update(patch).eq("id", row.id).select().single(), "Saving note");
      return { saved: true, notes: data };
    },
  },
  {
    name: "get_run_of_show",
    title: "Get run of show",
    description: "Day-of schedule for an offer: timeline items, venue contact and notes.",
    inputSchema: { type: "object", properties: { offer_id: { type: "string" } }, required: ["offer_id"] },
    annotations: RO,
    run: async (ctx, a) => {
      requireAccess(ctx);
      const { offer, show } = await getOfferRow(ctx, a.offer_id);
      const ros = must(await ctx.db.from("run_of_show").select("*").eq("offer_id", offer.id).maybeSingle(), "Loading run of show") as Any;
      if (ros) ros.schedule = [...(ros.schedule || [])].sort((x: Any, y: Any) => String(x.time).localeCompare(String(y.time)));
      return {
        ...summarize(offer, show), doors_time: offer.doors_time, show_time: offer.show_time, curfew_time: offer.curfew_time,
        run_of_show: ros ?? "No run of show yet — add items with update_run_of_show.",
        link: `${APP_URL}/offers/${offer.id}/run-of-show`,
      };
    },
  },
  {
    name: "update_run_of_show",
    title: "Update run of show",
    description: "Adds, changes or removes schedule items on an offer's run of show, and/or sets the venue contact and notes. Creates the run of show if it doesn't exist.",
    inputSchema: {
      type: "object",
      properties: {
        offer_id: { type: "string" },
        add_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              time: { type: "string", description: "HH:MM (24h)" },
              duration: { type: "integer", description: "Minutes" },
              title: { type: "string" },
              category: { type: "string", enum: ["production", "technical", "artist", "performance", "venue", "other"] },
              description: { type: "string" },
              responsible: { type: "string" },
            },
            required: ["time", "title"],
          },
        },
        update_items: {
          type: "array",
          description: "Change existing items by id (from get_run_of_show). Only fields you pass change.",
          items: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: true },
        },
        remove_item_ids: { type: "array", items: { type: "string" } },
        venue_contact: {
          type: "object",
          properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" } },
        },
        notes: { type: "string", description: "Replaces the run-of-show notes" },
      },
      required: ["offer_id"],
    },
    annotations: WRITE,
    run: async (ctx, a) => {
      requireAccess(ctx);
      const { offer, show } = await getOfferRow(ctx, a.offer_id);
      const cur = must(await ctx.db.from("run_of_show").select("*").eq("offer_id", offer.id).maybeSingle(), "Loading run of show") as Any;
      let schedule: Any[] = cur?.schedule || [];
      const remove = new Set(a.remove_item_ids || []);
      schedule = schedule.filter((i) => !remove.has(i.id));
      for (const u of a.update_items || []) {
        const i = schedule.findIndex((s) => s.id === u.id);
        if (i < 0) throw new UserError(`No run-of-show item with id "${u.id}".`);
        schedule[i] = { ...schedule[i], ...u };
      }
      for (const it of a.add_items || []) {
        schedule.push({
          id: crypto.randomUUID(), time: it.time, duration: it.duration ?? 30, title: it.title,
          category: it.category ?? "other", description: it.description ?? "", responsible: it.responsible ?? "",
        });
      }
      schedule.sort((x, y) => String(x.time).localeCompare(String(y.time)));
      const row: Any = { schedule, updated_at: new Date().toISOString() };
      if (a.venue_contact) row.venue_contact = { ...(cur?.venue_contact || {}), ...a.venue_contact };
      if (a.notes !== undefined) row.notes = a.notes;
      let data;
      if (cur) {
        data = must(await ctx.db.from("run_of_show").update(row).eq("id", cur.id).select().single(), "Saving run of show");
      } else {
        data = must(await ctx.db.from("run_of_show").insert({
          ...row, offer_id: offer.id, user_id: ctx.userId, event_date: show?.event_date || null,
          venue_contact: row.venue_contact || { name: "", phone: "", email: "" }, notes: row.notes || "",
        }).select().single(), "Creating run of show");
      }
      return { saved: true, run_of_show: data };
    },
  },
  {
    name: "generate_offer_pdf",
    title: "Generate offer PDF",
    description: "Builds the offer PDF exactly as the app does and returns a private download link (valid 24h). mode 'artist_offer' (default) is the clean version safe to send to an artist/agent; 'estimate' is the internal version with profit, break-even and expenses. Optionally also builds the one-page artist sheet for a lineup artist.",
    inputSchema: {
      type: "object",
      properties: {
        offer_id: { type: "string" },
        mode: { type: "string", enum: ["artist_offer", "estimate"], default: "artist_offer" },
        costs_only: { type: "boolean", description: "Leave out revenue projections", default: false },
        artist_sheet_for: { type: "string", description: "Optional: name (or event_artists id) of a lineup artist to also generate their one-page artist sheet" },
      },
      required: ["offer_id"],
    },
    annotations: WRITE,
    run: async (ctx, a) => {
      requireAccess(ctx);
      const { offer, show } = await getOfferRow(ctx, a.offer_id);
      const cs = await loadCompanySettings(ctx);
      const mode = a.mode === "estimate" ? "estimate" : "artist_offer";
      const pdf = buildOfferPdf(offer, show, cs, mode, a.costs_only === true);
      const stored = await storePdf(ctx, pdf.filename, pdf.base64);
      const out: Any = {
        offer_id: offer.id, mode, filename: pdf.filename, size_kb: Math.round((pdf.base64.length * 3) / 4 / 1024),
        download_url: stored.url, link_expires_in_hours: stored.expires_in_hours,
        note: mode === "estimate" ? "Internal estimate — includes your profit and expenses. Do not send to the artist." : "Artist-safe version.",
      };
      if (a.artist_sheet_for) {
        const { data: artists } = await ctx.db.from("event_artists").select("*").eq("offer_id", offer.id);
        const q = String(a.artist_sheet_for).toLowerCase();
        const artist = (artists || []).find((x: Any) => x.id === a.artist_sheet_for || String(x.artist_name || "").toLowerCase() === q)
          || (artists || []).find((x: Any) => String(x.artist_name || "").toLowerCase().includes(q));
        if (!artist) throw new UserError(`No lineup artist matching "${a.artist_sheet_for}" on this offer.`);
        const full = { ...offer, show };
        const sheetName = `${String(artist.artist_name || "artist").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}_artist_sheet.pdf`;
        const sheet = await storePdf(ctx, sheetName, artistSheetBase64(artist, full, cs) as string);
        out.artist_sheet = { artist: artist.artist_name, filename: sheetName, download_url: sheet.url };
      }
      return out;
    },
  },
  {
    name: "email_offer",
    title: "Email offer",
    description: "Emails the offer PDF from support@gozaentertainment.com on behalf of the signed-in promoter (replies go to the promoter's company email). Defaults: recipient = headliner's contact_email on the lineup, artist-safe PDF attached, promoter CC'd. ALWAYS confirm recipient, subject and message with the user before calling this — it sends a real email.",
    inputSchema: {
      type: "object",
      properties: {
        offer_id: { type: "string" },
        to: { type: "array", items: { type: "string" }, description: "Recipient email(s). If omitted, uses the headliner's contact_email." },
        subject: { type: "string", description: "Defaults to 'Offer: {artist} — {venue} · {date}'" },
        message: { type: "string", description: "Plain-text body. Defaults to a short professional note. Use blank lines between paragraphs." },
        mode: { type: "string", enum: ["artist_offer", "estimate"], default: "artist_offer", description: "Which PDF to attach. 'estimate' exposes internal profit — only for the promoter's own team." },
        attach_pdf: { type: "boolean", default: true },
        attach_artist_sheet_for: { type: "string", description: "Optional lineup artist name/id — also attaches their one-page artist sheet" },
        copy_me: { type: "boolean", default: true, description: "CC the signed-in promoter" },
      },
      required: ["offer_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    run: async (ctx, a) => {
      requireAccess(ctx);
      const { offer, show } = await getOfferRow(ctx, a.offer_id);
      const cs = await loadCompanySettings(ctx);
      const { data: artists } = await ctx.db.from("event_artists").select("*").eq("offer_id", offer.id).order("sort_order");
      const headliner = (artists || []).find((x: Any) => x.role === "headliner" && x.contact_email) || (artists || []).find((x: Any) => x.contact_email);

      let to: string[] = Array.isArray(a.to) ? a.to : typeof a.to === "string" ? [a.to] : [];
      to = to.map((e) => String(e).trim()).filter(Boolean);
      if (to.length === 0 && headliner?.contact_email) to = [headliner.contact_email];
      if (to.length === 0) throw new UserError("No recipient: pass `to`, or add a contact_email to the headliner on the lineup (update_lineup_artist).");
      const bad = to.find((e) => !EMAIL_RE.test(e));
      if (bad) throw new UserError(`"${bad}" is not a valid email address.`);

      const senderName = cs?.contact_name || cs?.company_name || ctx.email || "";
      const companyName = cs?.company_name || ctx.org.name || "";
      const artistName = show.artist_name || offer.artist_name || "the artist";
      const dateLong = fmtLongDate(show.event_date);
      const subject = (a.subject && String(a.subject).trim()) || `Offer: ${artistName} — ${show.venue_name}${dateLong ? ` · ${dateLong}` : ""}`;
      const message = (a.message && String(a.message).trim()) ||
        `Hi${headliner?.contact_name ? ` ${headliner.contact_name}` : headliner?.artist_name ? ` ${headliner.artist_name} team` : ""},\n\n` +
        `Please find attached our offer for ${artistName} at ${show.venue_name}${dateLong ? ` on ${dateLong}` : ""}.\n\n` +
        `Let us know if you have any questions — happy to jump on a call to walk through the details.\n\n` +
        `Thanks,\n${senderName}${companyName && companyName !== senderName ? `\n${companyName}` : ""}`;

      const attachments: Any[] = [];
      const mode = a.mode === "estimate" ? "estimate" : "artist_offer";
      if (a.attach_pdf !== false) {
        const pdf = buildOfferPdf(offer, show, cs, mode);
        attachments.push({ filename: pdf.filename, content: pdf.base64, type: "application/pdf" });
      }
      if (a.attach_artist_sheet_for) {
        const q = String(a.attach_artist_sheet_for).toLowerCase();
        const artist = (artists || []).find((x: Any) => x.id === a.attach_artist_sheet_for || String(x.artist_name || "").toLowerCase() === q)
          || (artists || []).find((x: Any) => String(x.artist_name || "").toLowerCase().includes(q));
        if (!artist) throw new UserError(`No lineup artist matching "${a.attach_artist_sheet_for}" on this offer.`);
        const sheetName = `${String(artist.artist_name || "artist").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}_artist_sheet.pdf`;
        attachments.push({ filename: sheetName, content: artistSheetBase64(artist, { ...offer, show }, cs), type: "application/pdf" });
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.token}` },
        body: JSON.stringify({
          to, subject, message, copy_self: a.copy_me !== false,
          sender_name: senderName, company_name: companyName, reply_to: cs?.email || undefined, attachments,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new UserError(`Email failed: ${out.error || res.status}`);

      // Note it on the offer so there's a record
      const stamp = `Emailed ${mode === "estimate" ? "internal estimate" : "offer"} to ${to.join(", ")} on ${new Date().toLocaleDateString("en-US")}${attachments.length ? ` (${attachments.map((x) => x.filename).join(", ")})` : ""}`;
      try {
        const { data: notesRow } = await ctx.db.from("offer_notes").select("*").eq("offer_id", offer.id).maybeSingle();
        if (notesRow) {
          await ctx.db.from("offer_notes").update({ event_notes: notesRow.event_notes ? `${notesRow.event_notes}\n${stamp}` : stamp, updated_at: new Date().toISOString() }).eq("id", notesRow.id);
        } else {
          await ctx.db.from("offer_notes").insert({ offer_id: offer.id, organization_id: ctx.org.id, event_notes: stamp, pinned_notes: [] });
        }
        if (!offer.offer_sent_date && mode === "artist_offer") {
          await ctx.db.from("offers").update({ offer_sent_date: new Date().toISOString().slice(0, 10) }).eq("id", offer.id);
        }
      } catch (e) { console.warn("note stamp failed", (e as Error).message); }

      return {
        sent: true, to, cc: a.copy_me !== false ? ctx.email : null, reply_to: out.reply_to || cs?.email || ctx.email,
        subject, attachments: attachments.map((x) => x.filename), offer_link: `${APP_URL}/offers/${offer.id}`,
      };
    },
  },
];
const toolMap = new Map(tools.map((t) => [t.name, t]));

// ---------- JSON-RPC ----------
const INSTRUCTIONS = `PromoterOS is a show-offer, deal and settlement tool for concert promoters.
Start with list_offers to find an offer_id. All money is USD. Use calculate_deal for what-if numbers (nothing is saved).
create_offer/update_offer recalculate the deal automatically. Always tell the user what changed and share the offer link.`;

async function handleRpc(msg: Any, ctx: Ctx): Promise<Any | null> {
  const { id, method, params } = msg || {};
  const reply = (result: Any) => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
  if (id === undefined || id === null) return null; // notification

  switch (method) {
    case "initialize": {
      const v = VERSIONS.includes(params?.protocolVersion) ? params.protocolVersion : VERSIONS[0];
      return reply({
        protocolVersion: v,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "promoteros", title: "PromoterOS", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({
        tools: tools.map(({ name, title, description, inputSchema, annotations }) => ({
          name, title, description, inputSchema, annotations: { title, ...annotations },
        })),
      });
    case "resources/list":
      return reply({ resources: [] });
    case "prompts/list":
      return reply({ prompts: [] });
    case "tools/call": {
      const tool = toolMap.get(params?.name);
      if (!tool) return fail(-32602, `Unknown tool: ${params?.name}`);
      try {
        const out = await tool.run(ctx, params?.arguments || {});
        return reply({
          content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
          structuredContent: out && typeof out === "object" && !Array.isArray(out) ? out : { result: out },
          isError: false,
        });
      } catch (e) {
        const text = e instanceof UserError ? e.message : `Something went wrong: ${(e as Error).message}`;
        if (!(e instanceof UserError)) console.error(tool.name, e);
        return reply({ content: [{ type: "text", text }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${method}`);
  }
}

function unauthorized(desc = "Sign in to PromoterOS") {
  return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: desc } }, 401, {
    "WWW-Authenticate": `Bearer realm="promoteros", error="invalid_token", error_description="${desc}", resource_metadata="${RESOURCE_METADATA}"`,
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*?\/promtp-mcp/, "") || "/";

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  if (path.startsWith("/.well-known/oauth-protected-resource")) {
    return json({
      resource: RESOURCE,
      authorization_servers: [AUTH_SERVER],
      scopes_supported: ["openid", "email", "profile"],
      bearer_methods_supported: ["header"],
      resource_name: "PromoterOS",
      resource_documentation: APP_URL,
    });
  }
  if (path.startsWith("/.well-known/oauth-authorization-server")) {
    // Convenience mirror for clients that look here first.
    const r = await fetch(`${PUBLIC_BASE}/.well-known/oauth-authorization-server/auth/v1`);
    return new Response(r.body, { status: r.status, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  if (req.method === "GET") {
    if ((req.headers.get("accept") || "").includes("text/event-stream")) {
      return new Response("SSE stream not supported", { status: 405, headers: { ...CORS, Allow: "POST" } });
    }
    return json({ name: "PromoterOS MCP server", endpoint: RESOURCE, docs: APP_URL });
  }
  if (req.method === "DELETE") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (!token) return unauthorized();
  // Validate up front so clients get a proper 401 and start the OAuth flow.
  const ctx = await loadCtx(token);
  if (!ctx) return unauthorized("Session expired - reconnect PromoterOS");

  let body: Any;
  try {
    body = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleRpc(m, ctx)))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
  }
  const out = await handleRpc(body, ctx);
  return out ? json(out) : new Response(null, { status: 202, headers: CORS });
});
